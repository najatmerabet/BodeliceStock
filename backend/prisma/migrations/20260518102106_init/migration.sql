/*
  Warnings:

  - A unique constraint covering the columns `[reference]` on the table `clients` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "produits_nom_key";

-- AlterTable
ALTER TABLE "clients" ADD COLUMN     "reference" TEXT;

-- CreateTable
CREATE TABLE "prix_client" (
    "id" SERIAL NOT NULL,
    "client_id" INTEGER NOT NULL,
    "produit_id" INTEGER NOT NULL,
    "prix" DECIMAL(10,2) NOT NULL,

    CONSTRAINT "prix_client_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "prix_client_client_id_produit_id_key" ON "prix_client"("client_id", "produit_id");

-- CreateIndex
CREATE UNIQUE INDEX "clients_reference_key" ON "clients"("reference");

-- AddForeignKey
ALTER TABLE "prix_client" ADD CONSTRAINT "prix_client_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prix_client" ADD CONSTRAINT "prix_client_produit_id_fkey" FOREIGN KEY ("produit_id") REFERENCES "produits"("id") ON DELETE CASCADE ON UPDATE CASCADE;
