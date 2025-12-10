-- DropIndex
DROP INDEX "ProductAttributeValue_productId_categoryAttributeId_key";

-- AlterTable
ALTER TABLE "CategoryAttribute" ADD COLUMN     "group" TEXT,
ADD COLUMN     "maxValue" DOUBLE PRECISION,
ADD COLUMN     "minValue" DOUBLE PRECISION,
ADD COLUMN     "unit" TEXT;

-- AlterTable
ALTER TABLE "ProductAttributeValue" ADD COLUMN     "rawJson" JSONB;

-- CreateIndex
CREATE INDEX "ProductAttributeValue_productId_categoryAttributeId_idx" ON "ProductAttributeValue"("productId", "categoryAttributeId");

-- CreateIndex
CREATE INDEX "ProductAttributeValue_categoryAttributeId_value_idx" ON "ProductAttributeValue"("categoryAttributeId", "value");
