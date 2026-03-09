# Migración Product.userId (marketplace unificado)

`prisma migrate deploy` aplica **todas** las migraciones pendientes. Para ejecutar en **3 etapas** (recomendado en producción):

1. **Aplicar solo la primera migración** (añade `userId` nullable):
   ```bash
   psql $DATABASE_URL -f prisma/migrations/20260308120000_add_product_user_id_optional/migration.sql
   npx prisma migrate resolve --applied 20260308120000_add_product_user_id_optional
   ```

2. **Backfill** (rellenar `userId` desde `Store.ownerId`):
   ```bash
   psql $DATABASE_URL -f prisma/migrations/BACKFILL_product_user_id.sql
   ```

3. **Aplicar la segunda migración** (`userId` obligatorio, `storeId` opcional):
   ```bash
   npx prisma migrate deploy
   ```
   Solo quedará pendiente `20260308120001_product_user_required_store_optional`.

---

**Alternativa (entorno local / BD vacía o ya con backfill):** Si no necesitas pausar entre etapas, puedes aplicar la primera migración, ejecutar el backfill y luego `npx prisma migrate deploy` para la segunda.
