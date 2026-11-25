# Modo vendedor y tiendas (PERSONAL / STORE)

Documentación interna: la tienda es la **identidad pública profesional del usuario**, no una entidad que posee productos. Los productos **siempre pertenecen al usuario** (owner = `userId`).

## Modelo de dominio

- **User.sellerMode** (`PERSONAL` | `STORE`): modo de venta. Por defecto `PERSONAL`. Pasa a `STORE` al crear/activar la única tienda; vuelve a `PERSONAL` al desactivar, perder plan o eliminar la tienda.
- **Store**: una por cuenta (máx.). Representa la **capa visual/comercial** del perfil (marca, escaparate). No es la propietaria de los listings.
- **Product**: el propietario real es siempre **User** (`userId`). Mostrar un producto "como tienda" o "como usuario" depende del `sellerMode` del usuario y del estado de su store en el momento de la visualización, no de un `storeId` en el producto.
- **Product.storeId** y **Product.listingMode**: **deprecated**. Se mantienen en BD por compatibilidad; no se usan para lógica de ownership ni para decidir si un producto es "personal" o "de tienda". Los nuevos productos se crean sin depender de ellos; el front puede seguir recibiendo estos campos en respuestas (legacy).

## Reglas de negocio

1. **Una tienda por cuenta**: `POST /stores` comprueba que el usuario no tenga ya una tienda.
2. **Crear producto**: cualquier usuario autenticado puede crear productos. No se exige tienda ni `canPublishAsStore`. Ownership = siempre `userId`.
3. **Crear/activar tienda**: el usuario pasa a `sellerMode = STORE` y la tienda tiene `subscriptionStatus = ACTIVE`. No se mueven ni transforman productos.
4. **Desactivar/eliminar tienda**: `sellerMode` vuelve a `PERSONAL` cuando corresponda. Los productos no se modifican (siguen siendo del usuario).
5. **Listado "por tienda"**: `GET /products/by-store?storeId=X` y filtro `storeId` en listado devuelven los productos del **dueño de la tienda** (`store.ownerId`), no por `Product.storeId`.
6. **Pedidos**: el `storeId` del pedido se obtiene de la tienda del **vendedor** (usuario dueño de los productos). Si el vendedor no tiene tienda, no se puede crear el pedido (mensaje claro al cliente).

## Contexto de vendedor (auth, users, stores)

Los endpoints devuelven para el front:

- **sellerMode**: PERSONAL | STORE.
- **store**: datos de la única tienda (id, name, status, subscriptionStatus) o null.
- **canPublishAsStore**: si tiene tienda activa con plan (para mostrar perfil como tienda / ventajas comerciales). **No** se usa para permitir o bloquear la creación de productos; publicar producto es siempre posible como usuario.

Endpoints: `POST /auth/register`, `POST /auth/login`, `POST /auth/otp/verify`, `GET /users/me`, `GET /users/me/profile`, `GET /stores/me/context`.

## Migraciones y schema

- **Sin migración de datos** para retirar columnas: `Product.storeId` y `Product.listingMode` se dejan en el schema como deprecated; la lógica no depende de ellos. Opcionalmente se puede planear una migración futura que los elimine.
- En creación/edición de productos no se exige ni se usa `storeId` ni `listingMode` para ownership.

## Resumen

| Antes | Ahora |
|-------|--------|
| Producto "de tienda" vs "personal" según `listingMode`/`storeId` | Productos siempre del usuario; vista "tienda" según `sellerMode` + estado store |
| Crear producto como STORE requería tienda activa | Crear producto siempre permitido; tienda solo capa visual |
| Endpoint mover producto a tienda | Eliminado (ya no aplica) |
| Listado por tienda = `Product.storeId` | Listado por tienda = productos de `store.ownerId` |
