# Onboarding de tienda y ubicaciones (Mauritania)

## Resumen

Refactorización del CRUD de tiendas para soportar un **onboarding moderno en varios pasos**, con datos reales de tienda, **una tienda por cuenta**, y sin romper el CRUD existente.

---

## 1. Modelo de negocio de tienda (Store)

### Campos principales (flujo de onboarding)

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `businessType` | `StoreBusinessType` (enum) | SUPERMARKET, PHARMACY, FASHION, ELECTRONICS, RESTAURANT, SERVICES, AUTOMOTIVE, OTHER |
| `logoUrl` | string (URL) | Logo de la tienda |
| `bannerUrl` | string (URL) | Imagen de portada/cabecera |
| `phone` | string (único) | Teléfono normalizado **+222XXXXXXXX** (Mauritania). El frontend solo envía la parte local (`phoneLocalPart`). |
| `regionCode` | string | Código de wilaya (región) |
| `regionName` | string | Nombre de wilaya |
| `departmentCode` | string | Código de moughataa (departamento) |
| `departmentName` | string | Nombre de moughataa |
| `address` | string | Dirección libre (complemento) |
| `city` | string | Ciudad |
| `contactEmail` | string | Email de contacto |

### Regla de teléfono

- Prefijo fijo **+222** (Mauritania). El backend normaliza y persiste el valor completo.
- El frontend envía solo la **parte local** del número (`phoneLocalPart`): 8 o 9 dígitos.
- El teléfono de tienda es **único** en el sistema (sin duplicidades).
- En **update**, enviar `phoneLocalPart: ""` borra el teléfono de la tienda.

### Campos legacy (deprecados en el flujo visible)

Se mantienen en el schema y en la API por compatibilidad hacia atrás; no forman parte del flujo principal de onboarding:

- `logoImageUrl`, `coverImageUrl` → usar `logoUrl`, `bannerUrl`
- `contactPhone`, `whatsappNumber` → usar `phone` (normalizado +222)
- `region` (texto libre) → usar `regionCode` / `regionName`
- `facebookUrl`, `instagramUrl`, `twitterUrl`, `tiktokUrl`, `websiteUrl` → deprecated; no mostrarlos en el onboarding principal

---

## 2. Endpoint de ubicaciones: GET /locations/mauritania

Fuente estable para que el frontend alimente **selects dependientes** (región → departamento).

### Respuesta

```json
{
  "country": "MR",
  "wilayas": [
    {
      "code": "adrar",
      "name": "Adrar",
      "moughataas": [
        { "code": "aoujeft", "name": "Aoujeft" },
        { "code": "atar", "name": "Atar" },
        ...
      ]
    },
    ...
  ]
}
```

- **Wilayas** = regiones (15 en total: 12 nacionales + 3 en el distrito capital Nouakchott).
- **Moughataas** = departamentos dentro de cada wilaya.
- Datos versionables en código: `src/locations/data/mauritania-locations.ts`.

Uso típico en el frontend: primer select = wilaya; segundo select = moughataas de la wilaya elegida. Al guardar la tienda se envían `regionCode`, `regionName`, `departmentCode`, `departmentName` según los ítems seleccionados.

---

## 3. Compatibilidad hacia atrás

- **Tiendas existentes**: todos los nuevos campos son opcionales (nullable). Las tiendas ya creadas siguen funcionando sin cambios.
- **Create/Update**: se aceptan tanto los nuevos campos como los legacy (`logoImageUrl`, `contactPhone`, `region`, redes, etc.) para no romper clientes que aún los envían.
- **Respuestas GET**: se devuelven todos los campos (nuevos y legacy); el cliente puede priorizar los nuevos para el onboarding.

---

## 4. Validaciones

- **phoneLocalPart**: solo dígitos; longitud 8–9 (parte local Mauritania). Opcional en create; en update puede ser `""` para borrar el teléfono.
- **Unicidad de teléfono**: al crear o actualizar, si se envía `phoneLocalPart`, el backend comprueba que no exista otra tienda con el mismo número normalizado (+222 + parte local).

---

## 5. Archivos tocados (resumen)

- **Prisma**: `prisma/schema.prisma` (enum `StoreBusinessType`, nuevos campos en `Store`, deprecaciones comentadas).
- **Migración**: `prisma/migrations/20260313120000_store_onboarding_wilayas_phone/migration.sql`.
- **DTOs**: `src/stores/dto/create-store.dto.ts`, `src/stores/dto/update-store.dto.ts` (nuevos campos, `phoneLocalPart`, validaciones).
- **Servicio**: `src/stores/stores.service.ts` (normalización +222, unicidad de teléfono, create/update con nuevos campos).
- **Locations**: `src/locations/data/mauritania-locations.ts`, `src/locations/locations.controller.ts`, `src/locations/locations.module.ts`.
- **App**: `src/app.module.ts` (registro de `LocationsModule`).
