-- AlterTable
ALTER TABLE "AttributeOption" ADD COLUMN "parentOptionId" INTEGER;

-- CreateIndex
CREATE INDEX "AttributeOption_parentOptionId_idx" ON "AttributeOption"("parentOptionId");

-- AddForeignKey
ALTER TABLE "AttributeOption" ADD CONSTRAINT "AttributeOption_parentOptionId_fkey" FOREIGN KEY ("parentOptionId") REFERENCES "AttributeOption"("id") ON DELETE SET NULL ON UPDATE CASCADE;
