-- CreateEnum
CREATE TYPE "SellerMode" AS ENUM ('PERSONAL', 'STORE');

-- CreateEnum
CREATE TYPE "StoreSubscriptionStatus" AS ENUM ('NONE', 'ACTIVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "ListingMode" AS ENUM ('PERSONAL', 'STORE');

-- AlterTable "User": add sellerMode with default
ALTER TABLE "User" ADD COLUMN "sellerMode" "SellerMode" NOT NULL DEFAULT 'PERSONAL';

-- AlterTable "Store": add subscriptionStatus with default
ALTER TABLE "Store" ADD COLUMN "subscriptionStatus" "StoreSubscriptionStatus" NOT NULL DEFAULT 'NONE';

-- AlterTable "Product": add listingMode (nullable first for backfill)
ALTER TABLE "Product" ADD COLUMN "listingMode" "ListingMode";

-- Backfill Product.listingMode: STORE if storeId IS NOT NULL, else PERSONAL
UPDATE "Product" SET "listingMode" = 'STORE' WHERE "storeId" IS NOT NULL;
UPDATE "Product" SET "listingMode" = 'PERSONAL' WHERE "storeId" IS NULL;

-- Now set NOT NULL and default for new rows
ALTER TABLE "Product" ALTER COLUMN "listingMode" SET NOT NULL;
ALTER TABLE "Product" ALTER COLUMN "listingMode" SET DEFAULT 'PERSONAL';
