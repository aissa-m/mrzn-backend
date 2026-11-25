# Arquitectura: OTP con providers intercambiables (local / Twilio Verify)

## Objetivo

Mantener dos sistemas OTP bien separados y alternables por variable de entorno:

- **Provider 1 (local):** OTP actual (generación, hash en DB, validación local, opcionalmente SMS vía `ISmsService`).
- **Provider 2 (Twilio):** Twilio Verify (envío y verificación vía API).

Sin cambiar endpoints, DTOs ni flujo posterior (creación de usuario, JWT). El provider se elige en arranque con `OTP_PROVIDER=local | twilio`.

---

## 1. Arquitectura propuesta

### 1.1 Patrón: Strategy + inyección por token

- **Interfaz única:** `IOtpProvider` con dos métodos:
  - `requestOtp(phone: string): Promise<{ success: boolean; devOtp?: string }>`
  - `verifyCode(phone: string, code: string): Promise<void>` (lanza `BadRequestException` con códigos estándar si falla)

- **OtpService** solo:
  - Normaliza el teléfono.
  - Delega “solicitar OTP” en `provider.requestOtp(phone)` (ignora cualquier `desiredRole`).
  - Delega “validar código” en `provider.verifyCode(phone, code)`.
  - Después de `verifyCode` exitoso: find/create user de forma **neutra respecto al rol** (sin `ROLE_MISMATCH`), devolución del mismo shape de usuario. No contiene lógica de generación/almacenamiento/validación del código.

- **Providers:**
  - **LocalOtpProvider:** Toda la lógica actual de OTP (rate limit con `otpCode`, generación, bcrypt, `OtpCode`, envío vía `ISmsService` en prod, bypass `000000` solo en no-production).
  - **TwilioOtpProvider:** Llama a Twilio Verify (start + check), mapea errores de Twilio a `OTP_RATE_LIMIT`, `OTP_EXPIRED`, `OTP_TOO_MANY_ATTEMPTS`, `OTP_INVALID`. No usa Prisma ni tabla `OtpCode`.

### 1.2 Contrato de errores (sin cambios en OTP; sin ROLE_MISMATCH)

Los controladores y clientes siguen recibiendo los mismos códigos:

- `OTP_RATE_LIMIT` – demasiadas solicitudes para el teléfono.
- `OTP_EXPIRED` – código caducado o ya usado.
- `OTP_TOO_MANY_ATTEMPTS` – demasiados intentos fallidos.
- `OTP_INVALID` – código incorrecto.

Cada provider traduce sus propios errores (p. ej. respuestas de Twilio Verify) a este contrato.

### 1.3 Bypass de desarrollo

- Solo **LocalOtpProvider** conoce el bypass `000000`.
- Se usa únicamente cuando `NODE_ENV !== 'production'`; en producción ese camino no se ejecuta.
- **TwilioOtpProvider** no tiene bypass; en desarrollo se pueden usar credenciales de test de Twilio si se desea.

### 1.4 Selección del provider en arranque

- Variable: `OTP_PROVIDER=local | twilio` (por defecto `local` si no está definida).
- En `AuthModule`, un `useFactory` inyecta `LocalOtpProvider` y `TwilioOtpProvider` y provee el token `OTP_PROVIDER` con la instancia correspondiente según `process.env.OTP_PROVIDER`.
- `OtpService` recibe `@Inject(OTP_PROVIDER) private provider: IOtpProvider` y no sabe qué implementación está detrás.

### 1.5 Dependencias por componente

| Componente          | Dependencias                                      |
|---------------------|---------------------------------------------------|
| OtpService          | `PrismaService`, `OTP_PROVIDER`                   |
| LocalOtpProvider     | `PrismaService`, `SMS_SERVICE`                    |
| TwilioOtpProvider   | Ninguna (lee `process.env` o ConfigService)       |

`AuthModule` debe seguir importando `SmsModule` para que `LocalOtpProvider` reciba `SMS_SERVICE`. Si en el futuro solo se usa Twilio, se puede dejar de registrar `LocalOtpProvider` o de importar `SmsModule` cuando no haga falta.

---

## 2. Estructura de archivos propuesta

```
src/auth/
  interfaces/
    otp-provider.interface.ts    # IOtpProvider + token OTP_PROVIDER
  providers/
    local-otp.provider.ts       # LocalOtpProvider (lógica actual movida aquí)
    twilio-otp.provider.ts      # TwilioOtpProvider (Twilio Verify API)
  otp.service.ts                # Refactor: delega en provider, mantiene user + role
  auth.module.ts                # Registro de providers y useFactory(OTP_PROVIDER)
  auth.controller.ts            # Sin cambios
  auth.service.ts               # Sin cambios
  dto.ts                        # Sin cambios
  ...
  otp.service.spec.ts           # Ajustar: mock de OTP_PROVIDER + Prisma user
  providers/
    local-otp.provider.spec.ts  # Tests de LocalOtpProvider (lógica OTP local)
    twilio-otp.provider.spec.ts # Tests de TwilioOtpProvider (mock Twilio client)
```

No se crea carpeta `auth/otp/` para no anidar de más; `interfaces/` y `providers/` bajo `auth/` son suficientes.

---

## 3. Cambios concretos por archivo

### 3.1 Nuevos archivos

| Archivo | Descripción |
|---------|-------------|
| **`src/auth/interfaces/otp-provider.interface.ts`** | Define `OTP_PROVIDER` (Symbol) e `IOtpProvider`: `requestOtp(phone)` y `verifyCode(phone, code)`. Documentar que `verifyCode` debe lanzar `BadRequestException` con `code` en `OTP_RATE_LIMIT \| OTP_EXPIRED \| OTP_TOO_MANY_ATTEMPTS \| OTP_INVALID`. |
| **`src/auth/providers/local-otp.provider.ts`** | Clase `LocalOtpProvider` que implementa `IOtpProvider`. Mover aquí: constantes (OTP_LENGTH, TTL, MAX_ATTEMPTS, RATE_LIMIT_*), `normalizePhone` (o usar la que quede en OtpService y pasar phone ya normalizado), `generateNumericOtp`, `DEV_OTP_BYPASS`. Inyectar `PrismaService` y `SMS_SERVICE`. `requestOtp`: rate limit con `otpCode.count`, invalidar previos, generar código, hash, `otpCode.create`, en dev log + `devOtp`, en prod `sms.sendOtp`. `verifyCode`: `otpCode.findFirst`, si no hay registro → OTP_EXPIRED; validar con bypass (solo si `NODE_ENV !== 'production'`) o bcrypt; intentos y OTP_TOO_MANY_ATTEMPTS / OTP_INVALID; marcar `consumedAt`. No tocar User; solo OTP. |
| **`src/auth/providers/twilio-otp.provider.ts`** | Clase `TwilioOtpProvider` que implementa `IOtpProvider`. Usar SDK de Twilio Verify (o `fetch` a la API). Constructor/config: `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_VERIFY_SERVICE_SID`. `requestOtp`: llamar a Verification Create (canal SMS); en caso de error de rate limit de Twilio → `OTP_RATE_LIMIT`; devolver `{ success: true }` (y opcionalmente `devOtp` solo en dev si Twilio devuelve código de test). `verifyCode`: llamar a Verification Check; si status `approved` → return; si `expired`/`canceled` → OTP_EXPIRED; si `pending` o código incorrecto → OTP_INVALID; si límite de intentos → OTP_TOO_MANY_ATTEMPTS. Documentar mapeo exacto según documentación de Twilio Verify. |
| **`src/auth/providers/local-otp.provider.spec.ts`** | Tests unitarios de `LocalOtpProvider`: request (éxito, rate limit, devOtp en dev); verifyCode (éxito, bypass en dev, OTP_EXPIRED, OTP_INVALID, OTP_TOO_MANY_ATTEMPTS). Mock de Prisma (`otpCode`, sin `user`) y de `SMS_SERVICE`. |
| **`src/auth/providers/twilio-otp.provider.spec.ts`** | Tests unitarios de `TwilioOtpProvider`: mock del cliente Twilio Verify; request (éxito, mapeo de error a OTP_RATE_LIMIT); verifyCode (éxito, OTP_EXPIRED, OTP_INVALID, OTP_TOO_MANY_ATTEMPTS). |

### 3.2 Archivos a modificar

| Archivo | Cambios |
|---------|---------|
| **`src/auth/otp.service.ts`** | Eliminar toda la lógica de generación, hash, `otpCode`, bcrypt, SMS y bypass. Mantener `normalizePhone` (exportada si la usan los specs). Constructor: `PrismaService` + `@Inject(OTP_PROVIDER) private provider: IOtpProvider`. `requestOtp(phone, desiredRole?)`: `normalized = normalizePhone(phone)`; `return this.provider.requestOtp(normalized)`. `verifyOtp(phone, code, desiredRole?)`: `normalized = normalizePhone(phone)`; `await this.provider.verifyCode(normalized, code)`; a continuación, lógica de usuario **sin comprobación de rol**: `findUnique` por phone; si existe se devuelve tal cual; si no existe `user.create` con rol por defecto (`USER`); devolver el mismo objeto user (sin password). Sin referencias a `otpCode`, `bcrypt` ni `SMS_SERVICE`. |
| **`src/auth/auth.module.ts`** | Añadir imports: `OTP_PROVIDER`, `IOtpProvider` (tipo), `LocalOtpProvider`, `TwilioOtpProvider`. En `providers`: registrar `LocalOtpProvider`, `TwilioOtpProvider`, y `{ provide: OTP_PROVIDER, useFactory: (local, twilio) => process.env.OTP_PROVIDER === 'twilio' ? twilio : local, inject: [LocalOtpProvider, TwilioOtpProvider] }`. Mantener `SmsModule` en imports y `OtpService` en providers. No modificar AuthService ni controladores. |
| **`src/auth/otp.service.spec.ts`** | Dejar de mockear Prisma `otpCode` y SMS; mockear `OTP_PROVIDER`: `requestOtp` resuelve `{ success: true }`, `verifyCode` resuelve sin valor. Mockear Prisma solo para `user.findUnique` y `user.create`. Tests: request delega al provider; verify llama a `verifyCode` y luego flujo de usuario (usuario existente, usuario nuevo, ROLE_MISMATCH). Opcional: test que verifica que si `provider.verifyCode` lanza OTP_INVALID, el servicio propaga la excepción y no llega a buscar usuario. |

### 3.3 Archivos que no se modifican (según requisitos)

- **`src/auth/auth.controller.ts`** – Sin cambios.
- **`src/auth/auth.service.ts`** – Sin cambios.
- **`src/auth/dto.ts`** – Sin cambios.
- **`src/auth/auth.controller.spec.ts`** – Sin cambios (sigue mockeando OtpService; la interfaz pública de OtpService es la misma).

### 3.4 Variable de entorno

- Añadir en `.env.example` (y documentar en README si aplica):
  - `OTP_PROVIDER=local` | `twilio` (por defecto `local`).
  - Para Twilio: `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_VERIFY_SERVICE_SID`.

### 3.5 Garantías

- **Producción sin bypass:** En `LocalOtpProvider`, el uso de `DEV_OTP_BYPASS` debe estar condicionado a `process.env.NODE_ENV !== 'production'`. En producción ese bloque no se ejecuta.
- **Código local aislado:** Cuando `OTP_PROVIDER=twilio`, solo se instancia y usa `TwilioOtpProvider`; `LocalOtpProvider` no interviene en el flujo de OTP (sigue registrado por el factory, pero no es el que se inyecta en OtpService).
- **Contrato de errores:** Ambos providers lanzan `BadRequestException` con `response: { code, message }` usando los mismos códigos; TwilioOtpProvider mapea estados/errores de la API al contrato anterior.

---

## 4. Resumen de responsabilidades

| Responsabilidad | LocalOtpProvider | TwilioOtpProvider | OtpService |
|----------------|------------------|--------------------|------------|
| Rate limit OTP | Sí (otpCode.count) | Twilio / opcional | No |
| Generar código | Sí | No (Twilio) | No |
| Almacenar/hashear código | Sí (OtpCode) | No | No |
| Enviar código (SMS) | Sí (dev: log; prod: ISmsService) | No (Twilio) | No |
| Verificar código | Sí (bcrypt / bypass dev) | Sí (API Check) | No |
| Bypass dev 000000 | Sí (solo no prod) | No | No |
| Normalizar phone | Recibe ya normalizado | Recibe ya normalizado | Sí |
| Find/create user | No | No | Sí (sin chequeos de rol) |
| Devolver user para JWT | No | No | Sí (tras verifyCode OK) |

Esta separación mantiene el diseño limpio, escalable y profesional, y permite cambiar de provider sin tocar AuthService ni controladores.
