-- Paso 2 de la migración marketplace: userId obligatorio, storeId opcional.
-- Ejecutar SOLO después de haber aplicado el backfill (BACKFILL_product_user_id.sql).
-- Si hay productos con userId nulo, este ALTER fallará.

-- AlterTable
ALTER TABLE "Product" ALTER COLUMN "userId" SET NOT NULL;

-- AlterTable
ALTER TABLE "Product" ALTER COLUMN "storeId" DROP NOT NULL;
