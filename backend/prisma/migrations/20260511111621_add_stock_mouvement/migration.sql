/*
  Warnings:

  - A unique constraint covering the columns `[proforma_id]` on the table `factures` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "bons_livraison" ADD COLUMN     "proforma_id" INTEGER;

-- AlterTable
ALTER TABLE "factures" ADD COLUMN     "proforma_id" INTEGER,
ADD COLUMN     "totalHT" DECIMAL(10,2) NOT NULL DEFAULT 0,
ADD COLUMN     "totalRemise" DECIMAL(10,2) NOT NULL DEFAULT 0,
ADD COLUMN     "totalTVA" DECIMAL(10,2) NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "produits" ADD COLUMN     "tva" DECIMAL(5,2) NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "stock_mouvements" (
    "id" SERIAL NOT NULL,
    "produit_id" INTEGER NOT NULL,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "type" TEXT NOT NULL,
    "ancienneQte" DECIMAL(10,2) NOT NULL,
    "nouvelleQte" DECIMAL(10,2) NOT NULL,
    "delta" DECIMAL(10,2) NOT NULL,
    "motif" TEXT,

    CONSTRAINT "stock_mouvements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "factures_proforma" (
    "id" SERIAL NOT NULL,
    "numero" TEXT NOT NULL,
    "client_id" INTEGER NOT NULL,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "totalHT" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "totalRemise" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "totalTVA" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "totalTTC" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "statut" TEXT NOT NULL DEFAULT 'BROUILLON',

    CONSTRAINT "factures_proforma_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lignes_proforma" (
    "id" SERIAL NOT NULL,
    "proforma_id" INTEGER NOT NULL,
    "produit_id" INTEGER NOT NULL,
    "quantite" DECIMAL(10,2) NOT NULL,
    "prix" DECIMAL(10,2) NOT NULL,
    "remise" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "tva" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "totalAvantRemise" DECIMAL(10,2) NOT NULL,
    "totalApresRemise" DECIMAL(10,2) NOT NULL,
    "totalTVA" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "totalTTC" DECIMAL(10,2) NOT NULL,

    CONSTRAINT "lignes_proforma_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "factures_avoir" (
    "id" SERIAL NOT NULL,
    "numero" TEXT NOT NULL,
    "facture_id" INTEGER NOT NULL,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "total" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "motif" TEXT,

    CONSTRAINT "factures_avoir_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lignes_avoir" (
    "id" SERIAL NOT NULL,
    "avoir_id" INTEGER NOT NULL,
    "produit_id" INTEGER NOT NULL,
    "nbUnites" DECIMAL(10,2),
    "poidsUnitaire" DECIMAL(10,2),
    "quantite" DECIMAL(10,2) NOT NULL,
    "prix" DECIMAL(10,2) NOT NULL,
    "total" DECIMAL(10,2) NOT NULL,

    CONSTRAINT "lignes_avoir_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "paiements" (
    "id" SERIAL NOT NULL,
    "facture_id" INTEGER NOT NULL,
    "montant" DECIMAL(10,2) NOT NULL,
    "methode" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "remarque" TEXT,

    CONSTRAINT "paiements_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "factures_proforma_numero_key" ON "factures_proforma"("numero");

-- CreateIndex
CREATE UNIQUE INDEX "factures_avoir_numero_key" ON "factures_avoir"("numero");

-- CreateIndex
CREATE UNIQUE INDEX "factures_proforma_id_key" ON "factures"("proforma_id");

-- AddForeignKey
ALTER TABLE "stock_mouvements" ADD CONSTRAINT "stock_mouvements_produit_id_fkey" FOREIGN KEY ("produit_id") REFERENCES "produits"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bons_livraison" ADD CONSTRAINT "bons_livraison_proforma_id_fkey" FOREIGN KEY ("proforma_id") REFERENCES "factures_proforma"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "factures_proforma" ADD CONSTRAINT "factures_proforma_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lignes_proforma" ADD CONSTRAINT "lignes_proforma_proforma_id_fkey" FOREIGN KEY ("proforma_id") REFERENCES "factures_proforma"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lignes_proforma" ADD CONSTRAINT "lignes_proforma_produit_id_fkey" FOREIGN KEY ("produit_id") REFERENCES "produits"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "factures" ADD CONSTRAINT "factures_proforma_id_fkey" FOREIGN KEY ("proforma_id") REFERENCES "factures_proforma"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "factures_avoir" ADD CONSTRAINT "factures_avoir_facture_id_fkey" FOREIGN KEY ("facture_id") REFERENCES "factures"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lignes_avoir" ADD CONSTRAINT "lignes_avoir_avoir_id_fkey" FOREIGN KEY ("avoir_id") REFERENCES "factures_avoir"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lignes_avoir" ADD CONSTRAINT "lignes_avoir_produit_id_fkey" FOREIGN KEY ("produit_id") REFERENCES "produits"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "paiements" ADD CONSTRAINT "paiements_facture_id_fkey" FOREIGN KEY ("facture_id") REFERENCES "factures"("id") ON DELETE CASCADE ON UPDATE CASCADE;
