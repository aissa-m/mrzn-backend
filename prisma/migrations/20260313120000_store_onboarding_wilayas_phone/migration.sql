-- CreateEnum: StoreBusinessType for store onboarding
CREATE TYPE "StoreBusinessType" AS ENUM ('SUPERMARKET', 'PHARMACY', 'FASHION', 'ELECTRONICS', 'RESTAURANT', 'SERVICES', 'AUTOMOTIVE', 'OTHER');

-- AlterTable Store: add onboarding and location fields (nullable for backward compatibility)
ALTER TABLE "Store" ADD COLUMN "businessType" "StoreBusinessType";
ALTER TABLE "Store" ADD COLUMN "logoUrl" TEXT;
ALTER TABLE "Store" ADD COLUMN "bannerUrl" TEXT;
ALTER TABLE "Store" ADD COLUMN "phone" TEXT;
ALTER TABLE "Store" ADD COLUMN "regionCode" TEXT;
ALTER TABLE "Store" ADD COLUMN "regionName" TEXT;
ALTER TABLE "Store" ADD COLUMN "departmentCode" TEXT;
ALTER TABLE "Store" ADD COLUMN "departmentName" TEXT;

-- Unique constraint on phone (only one store per normalized phone). Existing rows have phone NULL so safe.
CREATE UNIQUE INDEX "Store_phone_key" ON "Store"("phone");

-- Optional: backfill regionName from legacy region for existing stores (keep region column for legacy reads)
-- UPDATE "Store" SET "regionName" = "region" WHERE "region" IS NOT NULL AND "regionName" IS NULL;
