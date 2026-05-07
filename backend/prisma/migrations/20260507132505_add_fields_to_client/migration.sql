/*
  Warnings:

  - You are about to drop the column `prix` on the `produits` table. All the data in the column will be lost.
  - You are about to drop the column `stock` on the `produits` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[reference]` on the table `produits` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[nom]` on the table `produits` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `prixUnitaire` to the `produits` table without a default value. This is not possible if the table is not empty.
  - Added the required column `reference` to the `produits` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "clients" ADD COLUMN     "codepostal" TEXT,
ADD COLUMN     "email" TEXT,
ADD COLUMN     "ville" TEXT;

-- AlterTable
ALTER TABLE "produits" DROP COLUMN "prix",
DROP COLUMN "stock",
ADD COLUMN     "poidsUnitaire" DECIMAL(10,2) NOT NULL DEFAULT 1,
ADD COLUMN     "prixUnitaire" DECIMAL(10,2) NOT NULL,
ADD COLUMN     "quantite" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "reference" TEXT NOT NULL,
ADD COLUMN     "unite" TEXT NOT NULL DEFAULT 'kg';

-- CreateIndex
CREATE UNIQUE INDEX "produits_reference_key" ON "produits"("reference");

-- CreateIndex
CREATE UNIQUE INDEX "produits_nom_key" ON "produits"("nom");
