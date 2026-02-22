-- CreateEnum
CREATE TYPE "WalletLedgerType" AS ENUM ('TOPUP', 'SUBSCRIPTION_CHARGE', 'ADJUSTMENT');

-- CreateEnum
CREATE TYPE "PaymentIntentProvider" AS ENUM ('MOOSYL');

-- CreateEnum
CREATE TYPE "PaymentIntentPurpose" AS ENUM ('WALLET_TOPUP');

-- CreateEnum
CREATE TYPE "PaymentIntentStatus" AS ENUM ('CREATED', 'PENDING', 'PAID', 'FAILED', 'EXPIRED');

-- CreateTable
CREATE TABLE "Wallet" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "currency" VARCHAR(10) DEFAULT 'MRU',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Wallet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WalletLedger" (
    "id" SERIAL NOT NULL,
    "walletId" INTEGER NOT NULL,
    "type" "WalletLedgerType" NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "reference" VARCHAR(191),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WalletLedger_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentIntent" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "walletId" INTEGER NOT NULL,
    "provider" "PaymentIntentProvider" NOT NULL DEFAULT 'MOOSYL',
    "purpose" "PaymentIntentPurpose" NOT NULL DEFAULT 'WALLET_TOPUP',
    "amount" DECIMAL(12,2) NOT NULL,
    "status" "PaymentIntentStatus" NOT NULL DEFAULT 'CREATED',
    "transactionId" VARCHAR(191),
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PaymentIntent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WebhookEvent" (
    "id" SERIAL NOT NULL,
    "eventType" VARCHAR(64) NOT NULL,
    "transactionId" VARCHAR(191),
    "signature" VARCHAR(255),
    "rawBodyHash" VARCHAR(64) NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WebhookEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Wallet_userId_key" ON "Wallet"("userId");

-- CreateIndex
CREATE INDEX "Wallet_userId_idx" ON "Wallet"("userId");

-- CreateIndex
CREATE INDEX "WalletLedger_walletId_idx" ON "WalletLedger"("walletId");

-- CreateIndex
CREATE INDEX "WalletLedger_walletId_createdAt_idx" ON "WalletLedger"("walletId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentIntent_transactionId_key" ON "PaymentIntent"("transactionId");

-- CreateIndex
CREATE INDEX "PaymentIntent_userId_idx" ON "PaymentIntent"("userId");

-- CreateIndex
CREATE INDEX "PaymentIntent_transactionId_idx" ON "PaymentIntent"("transactionId");

-- CreateIndex
CREATE INDEX "PaymentIntent_status_idx" ON "PaymentIntent"("status");

-- CreateIndex
CREATE INDEX "WebhookEvent_transactionId_idx" ON "WebhookEvent"("transactionId");

-- CreateIndex
CREATE INDEX "WebhookEvent_receivedAt_idx" ON "WebhookEvent"("receivedAt");

-- CreateIndex
CREATE UNIQUE INDEX "WebhookEvent_rawBodyHash_key" ON "WebhookEvent"("rawBodyHash");

-- AddForeignKey
ALTER TABLE "Wallet" ADD CONSTRAINT "Wallet_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WalletLedger" ADD CONSTRAINT "WalletLedger_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES "Wallet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentIntent" ADD CONSTRAINT "PaymentIntent_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES "Wallet"("id") ON DELETE CASCADE ON UPDATE CASCADE;
