# Maurizone — API backend

Backend del marketplace **Maurizone** (Mauritania / MRU): NestJS, PostgreSQL y Prisma. Expone REST bajo el prefijo global `api`, documentación OpenAPI en desarrollo y integración de pagos vía **Moosyl**.

## Stack técnico

| Área | Tecnología |
|------|------------|
| Framework | [NestJS](https://nestjs.com/) 11 |
| Lenguaje | TypeScript 5 |
| ORM / BD | Prisma 6 + **PostgreSQL** |
| Auth | JWT (`@nestjs/jwt`, Passport), OTP por teléfono (local o Twilio) |
| Validación | `class-validator` + `class-transformer`, `ValidationPipe` global |
| API docs | Swagger (`/api/docs` en no producción) |
| Tiempo real | Socket.IO (`@nestjs/websockets`, gateway de chat y notificaciones) |
| Archivos | AWS SDK S3 (subida de imágenes de productos, etc.) |
| Pagos | Moosyl (webhook con cuerpo crudo para verificación HMAC) |
| Seguridad HTTP | Helmet, compresión, CORS configurable, rate limit en rutas OTP |

## Requisitos

- Node.js acorde al proyecto (recomendado: LTS actual)
- PostgreSQL accesible vía `DATABASE_URL`
- Variables de entorno (ver [`.env.example`](./.env.example))

## Puesta en marcha

```bash
npm install
cp .env.example .env   # y completar valores
npx prisma migrate dev
npx prisma generate
npm run prisma:seed    # opcional
npm run start:dev
```

- **API**: `http://localhost:3000/api` (puerto por `PORT`, por defecto 3000)
- **Swagger**: `http://localhost:3000/api/docs` (solo si `NODE_ENV !== production`)
- **Ficheros estáticos**: `/uploads` servido desde la carpeta `uploads` del proyecto

### Scripts útiles

| Script | Descripción |
|--------|-------------|
| `npm run build` | Compila a `dist/` |
| `npm run start:prod` | Ejecuta `node dist/main` |
| `npm run lint` | ESLint |
| `npm run test` | Tests unitarios (Jest) |
| `npm run test:cov` | Cobertura |
| `npm run test:e2e` | E2E (config en `test/jest-e2e.json`) |

## Arquitectura funcional (módulos)

Los módulos principales importados en `AppModule` cubren:

- **Auth / Users**: registro, login, OTP, perfil (`/users/me`, perfil público, transacciones/cartera en perfil)
- **Stores**: tiendas (una por cuenta en el flujo actual), onboarding con tipo de negocio, logo/banner, teléfono `+222…`, wilaya/moughataa
- **Products**: catálogo, estados (ACTIVE, RESERVED, SOLD, PAUSED), imágenes, relación con categoría única
- **Categories** y **Attributes**: categorías jerárquicas y atributos por categoría (tipos TEXT, NUMBER, SELECT, MULTISELECT, etc., con opciones y dependencias)
- **Orders**: pedidos ligados a usuario y tienda del vendedor
- **Cart** y **Favorites**: carrito por usuario y favoritos
- **Chat**: conversaciones por producto/tienda/pedido y canal de soporte
- **Notifications** y **Push tokens**: notificaciones in-app y tokens Expo
- **Feed** y **Search**: secciones de feed y búsqueda con sugerencias
- **Locations**: `GET /locations/mauritania` (wilayas y moughataas para el front)
- **Admin**: gestión (usuarios, categorías, atributos, health) y bootstrap del primer admin con header secreto
- **Moosyl**: intenciones de pago, cartera (ledger), webhooks idempotentes (`WebhookEvent`)

### Modelo de negocio reciente (vendedor / tienda)

Los productos **pertenecen siempre al usuario** (`userId`). La tienda es la capa comercial/visual; el modo `sellerMode` (PERSONAL | STORE) y el estado de la tienda definen cómo se muestra el vendedor. Detalle en [`docs/seller-mode-and-stores.md`](./docs/seller-mode-and-stores.md) y onboarding en [`docs/store-onboarding-and-locations.md`](./docs/store-onboarding-and-locations.md).

## Variables de entorno (resumen)

Definidas y documentadas en `.env.example`: `DATABASE_URL`, `JWT_SECRET`, `JWT_EXPIRES_IN`, proveedor OTP, Twilio (si aplica), `ADMIN_BOOTSTRAP_SECRET`, claves Moosyl y secreto de webhook. En producción conviene fijar **`CORS_ORIGIN`** (lista separada por comas); si está vacía o no es producción, CORS es permisivo.

## Puntos fuertes

1. **Dominio de marketplace bien modelado**: pedidos, chat tipo Wallapop, notificaciones, cartera, webhooks de pago e idempotencia.
2. **Schema Prisma expresivo**: enums claros, índices pensados para listados y atributos flexibles por categoría.
3. **Buenas prácticas HTTP**: validación global con lista blanca de DTOs, Helmet, compresión, raw body solo donde hace falta (Moosyl).
4. **Rate limiting en OTP**: reduce abuso de envío/verificación de códigos.
5. **Documentación interna** en `docs/` para decisiones de producto (modo vendedor, ubicaciones MR).
6. **Cobertura de tests** en muchos servicios/controladores (aunque parte está desincronizada; ver debilidades).

## Puntos débiles y riesgos

1. **Tests rotos o desactualizados** (estado verificado en el repo): varias suites fallan por expectativas antiguas (p. ej. ownership de producto por `userId` vs `store.ownerId`, firmas de controladores) y por dependencias no mockeadas en tests de controladores. Esto **dificulta refactor seguro** y CI fiable.
2. **E2E mínimo y probablemente incorrecto**: `test/app.e2e-spec.ts` no replica `setGlobalPrefix('api')` ni el mismo bootstrap que `main.ts`, y apunta a `/` en lugar de `/api`.
3. **Metadatos del paquete genéricos**: `name: "backend"`, sin descripción ni autor en `package.json`; poco útil para publicar o documentar el artefacto.
4. **Legado en schema**: campos deprecados en `Product` y `Store` (documentados) aumentan complejidad hasta que se planifique migración limpia.
5. **`S3Controller`**: existe un endpoint de subida en código pero el controlador **no está registrado** en `AppModule`; solo se usa `S3Service` desde productos — riesgo de confusión o código muerto.
6. **Throttling** aplicado de forma focalizada (sobre todo auth OTP); otras rutas públicas podrían necesitar límites según exposición.
7. **Dependencia `swagger` en package.json**: además de `@nestjs/swagger` / `swagger-ui-express`; conviene revisar si es redundante.

## Qué es urgente o “mal hecho” y conviene atacar pronto

| Prioridad | Tema | Por qué |
|-----------|------|--------|
| **Alta** | Arreglar o alinear tests con el código actual | Sin tests verdes, cada cambio puede romper producción sin aviso. |
| **Alta** | Revisar E2E + pipeline CI | Un smoke test real (`/api/health`, un flujo auth mínimo) con el mismo bootstrap que producción. |
| **Media** | Producción: `CORS_ORIGIN`, secretos JWT/Moosyl, desactivar OTP `000000` y `devOtp` | Seguridad y cumplimiento; el flujo local documentado en `.env.example` no debe llegar a prod. |
| **Media** | Endpoint S3: o registrar con auth/guards o eliminar el controlador huérfano | Evita superficie accidental si alguien lo cablea sin protección. |
| **Baja** | Limpiar TODOs de código y comentarios obsoletos (p. ej. en `categories.service`) | Higiene y claridad para nuevos desarrolladores. |

## Posibles líneas de avance (roadmap sugerido)

1. **CI/CD**: GitHub Actions / similar con `lint`, `test`, `prisma validate` y migraciones en entornos.
2. **Observabilidad**: logging estructurado, correlación de requests, métricas de salud más allá de `GET health`.
3. **Pagos y pedidos**: estados de pedido alineados con webhooks Moosyl; conciliación y reembolsos si el producto lo requiere.
4. **Búsqueda**: evolucionar de SQL/Prisma a índice dedicado (Meilisearch, OpenSearch, etc.) si el catálogo crece.
5. **Verificación de identidad**: el campo `nni` en usuario apunta a futura validación oficial (TODO en servicio de usuarios).
6. **Migración de legado**: plan para retirar `Product.storeId` / `listingMode` y campos deprecados de tienda cuando no haya clientes viejos.
7. **Documentación OpenAPI en staging** protegida por auth, si se desea docs fuera de local sin exponer todo en público.

## Licencia

`UNLICENSED` (privado) según `package.json`.

---

*README generado a partir del código y del estado del repositorio; si cambias rutas, prefijos o el modelo de ownership, actualiza este archivo y los tests en el mismo PR.*
