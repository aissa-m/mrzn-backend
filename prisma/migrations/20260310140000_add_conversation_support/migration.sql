-- AlterTable
ALTER TABLE "Conversation" ADD COLUMN "isSupport" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Conversation" ADD COLUMN "supportUserId" INTEGER;

-- CreateIndex
CREATE UNIQUE INDEX "Conversation_supportUserId_key" ON "Conversation"("supportUserId");

-- CreateIndex
CREATE INDEX "Conversation_isSupport_supportUserId_idx" ON "Conversation"("isSupport", "supportUserId");

-- AddForeignKey
ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_supportUserId_fkey" FOREIGN KEY ("supportUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
