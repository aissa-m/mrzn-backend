-- AlterTable User: add phone (nullable, unique), make name, email, password nullable
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "phone" TEXT;
ALTER TABLE "User" ALTER COLUMN "name" DROP NOT NULL;
ALTER TABLE "User" ALTER COLUMN "email" DROP NOT NULL;
ALTER TABLE "User" ALTER COLUMN "password" DROP NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS "User_phone_key" ON "User"("phone") WHERE "phone" IS NOT NULL;

-- CreateTable OtpCode
CREATE TABLE "OtpCode" (
    "id" SERIAL NOT NULL,
    "phone" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "consumedAt" TIMESTAMP(3),
    "purpose" TEXT DEFAULT 'login',

    CONSTRAINT "OtpCode_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "OtpCode_phone_consumedAt_idx" ON "OtpCode"("phone", "consumedAt");
CREATE INDEX "OtpCode_phone_expiresAt_idx" ON "OtpCode"("phone", "expiresAt");
