-- CreateEnum Gender (perfil ampliado)
CREATE TYPE "Gender" AS ENUM ('MALE', 'FEMALE', 'OTHER', 'PREFER_NOT_TO_SAY');

-- AlterTable User: add optional personal info fields (all nullable, no breaking change)
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "firstName" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "lastName" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "nni" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "addressLine1" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "addressLine2" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "city" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "region" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "postalCode" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "country" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "birthDate" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "gender" "Gender";

-- Unique index for nni (multiple NULLs allowed in PostgreSQL)
CREATE UNIQUE INDEX IF NOT EXISTS "User_nni_key" ON "User"("nni") WHERE "nni" IS NOT NULL;
