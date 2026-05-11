/*
  Warnings:

  - You are about to alter the column `quantite` on the `produits` table. The data in that column could be lost. The data in that column will be cast from `Integer` to `Decimal(10,2)`.

*/
-- AlterTable
ALTER TABLE "produits" ALTER COLUMN "quantite" SET DEFAULT 0,
ALTER COLUMN "quantite" SET DATA TYPE DECIMAL(10,2);
