/*
  Warnings:

  - You are about to drop the column `country` on the `Store` table. All the data in the column will be lost.
  - You are about to drop the column `latitude` on the `Store` table. All the data in the column will be lost.
  - You are about to drop the column `longitude` on the `Store` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Store" DROP COLUMN "country",
DROP COLUMN "latitude",
DROP COLUMN "longitude";
