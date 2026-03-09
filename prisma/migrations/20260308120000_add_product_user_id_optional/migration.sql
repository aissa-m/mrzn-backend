-- Paso 1 de la migración marketplace: añadir userId a Product (nullable).
-- Tras aplicar esta migración, ejecutar el backfill y luego la migración 20260308120001.

-- AlterTable
ALTER TABLE "Product" ADD COLUMN "userId" INTEGER;

-- CreateIndex
CREATE INDEX "Product_userId_idx" ON "Product"("userId");

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
