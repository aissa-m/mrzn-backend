-- AlterTable
ALTER TABLE "CategoryAttribute" ADD COLUMN "dependsOnAttributeId" INTEGER;

-- CreateIndex
CREATE INDEX "CategoryAttribute_dependsOnAttributeId_idx" ON "CategoryAttribute"("dependsOnAttributeId");

-- AddForeignKey
ALTER TABLE "CategoryAttribute" ADD CONSTRAINT "CategoryAttribute_dependsOnAttributeId_fkey" FOREIGN KEY ("dependsOnAttributeId") REFERENCES "CategoryAttribute"("id") ON DELETE SET NULL ON UPDATE CASCADE;
