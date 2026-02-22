-- CreateEnum
CREATE TYPE "AttributeType" AS ENUM ('TEXT', 'NUMBER', 'SELECT', 'MULTISELECT', 'BOOLEAN', 'DATE', 'URL');

-- CreateTable
CREATE TABLE "CategoryAttribute" (
    "id" SERIAL NOT NULL,
    "categoryId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "type" "AttributeType" NOT NULL DEFAULT 'TEXT',
    "description" TEXT,
    "isRequired" BOOLEAN NOT NULL DEFAULT false,
    "isFilterable" BOOLEAN NOT NULL DEFAULT true,
    "isSearchable" BOOLEAN NOT NULL DEFAULT false,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CategoryAttribute_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AttributeOption" (
    "id" SERIAL NOT NULL,
    "categoryAttributeId" INTEGER NOT NULL,
    "label" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AttributeOption_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductAttributeValue" (
    "id" SERIAL NOT NULL,
    "productId" INTEGER NOT NULL,
    "categoryAttributeId" INTEGER NOT NULL,
    "value" TEXT NOT NULL,
    "attributeOptionId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductAttributeValue_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CategoryAttribute_categoryId_idx" ON "CategoryAttribute"("categoryId");

-- CreateIndex
CREATE INDEX "CategoryAttribute_slug_idx" ON "CategoryAttribute"("slug");

-- CreateIndex
CREATE INDEX "CategoryAttribute_isFilterable_idx" ON "CategoryAttribute"("isFilterable");

-- CreateIndex
CREATE UNIQUE INDEX "CategoryAttribute_categoryId_slug_key" ON "CategoryAttribute"("categoryId", "slug");

-- CreateIndex
CREATE INDEX "AttributeOption_categoryAttributeId_idx" ON "AttributeOption"("categoryAttributeId");

-- CreateIndex
CREATE UNIQUE INDEX "AttributeOption_categoryAttributeId_value_key" ON "AttributeOption"("categoryAttributeId", "value");

-- CreateIndex
CREATE INDEX "ProductAttributeValue_productId_idx" ON "ProductAttributeValue"("productId");

-- CreateIndex
CREATE INDEX "ProductAttributeValue_categoryAttributeId_idx" ON "ProductAttributeValue"("categoryAttributeId");

-- CreateIndex
CREATE INDEX "ProductAttributeValue_value_idx" ON "ProductAttributeValue"("value");

-- CreateIndex
CREATE INDEX "ProductAttributeValue_attributeOptionId_idx" ON "ProductAttributeValue"("attributeOptionId");

-- CreateIndex
CREATE UNIQUE INDEX "ProductAttributeValue_productId_categoryAttributeId_key" ON "ProductAttributeValue"("productId", "categoryAttributeId");

-- AddForeignKey
ALTER TABLE "CategoryAttribute" ADD CONSTRAINT "CategoryAttribute_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttributeOption" ADD CONSTRAINT "AttributeOption_categoryAttributeId_fkey" FOREIGN KEY ("categoryAttributeId") REFERENCES "CategoryAttribute"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductAttributeValue" ADD CONSTRAINT "ProductAttributeValue_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductAttributeValue" ADD CONSTRAINT "ProductAttributeValue_categoryAttributeId_fkey" FOREIGN KEY ("categoryAttributeId") REFERENCES "CategoryAttribute"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductAttributeValue" ADD CONSTRAINT "ProductAttributeValue_attributeOptionId_fkey" FOREIGN KEY ("attributeOptionId") REFERENCES "AttributeOption"("id") ON DELETE SET NULL ON UPDATE CASCADE;
