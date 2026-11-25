-- CreateEnum
CREATE TYPE "ProductStatus" AS ENUM ('ACTIVE', 'RESERVED', 'SOLD', 'PAUSED');

-- AlterTable: add status column with default ACTIVE
ALTER TABLE "Product"
ADD COLUMN "status" "ProductStatus" NOT NULL DEFAULT 'ACTIVE';

-- Backfill: map legacy isActive to new status
-- isActive = true  -> ACTIVE
-- isActive = false -> PAUSED
UPDATE "Product"
SET "status" = CASE
  WHEN "isActive" = TRUE THEN 'ACTIVE'
  ELSE 'PAUSED'
END;

-- Optional: future migrations may drop "isActive" once fully deprecated.

