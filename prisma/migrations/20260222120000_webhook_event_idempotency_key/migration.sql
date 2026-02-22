-- AlterTable WebhookEvent: add provider + idempotencyKey for stable idempotency, keep rawBodyHash for audit
ALTER TABLE "WebhookEvent" ADD COLUMN IF NOT EXISTS "provider" VARCHAR(32);
ALTER TABLE "WebhookEvent" ADD COLUMN IF NOT EXISTS "idempotencyKey" VARCHAR(255);

-- Backfill existing rows so we can add NOT NULL and unique constraint
UPDATE "WebhookEvent" SET "provider" = 'MOOSYL', "idempotencyKey" = COALESCE("rawBodyHash", 'legacy-' || "id"::text) WHERE "provider" IS NULL;

ALTER TABLE "WebhookEvent" ALTER COLUMN "provider" SET NOT NULL;
ALTER TABLE "WebhookEvent" ALTER COLUMN "idempotencyKey" SET NOT NULL;
ALTER TABLE "WebhookEvent" ALTER COLUMN "rawBodyHash" DROP NOT NULL;

-- Drop old unique, add new compound unique
DROP INDEX IF EXISTS "WebhookEvent_rawBodyHash_key";
CREATE UNIQUE INDEX "WebhookEvent_provider_idempotencyKey_key" ON "WebhookEvent"("provider", "idempotencyKey");
