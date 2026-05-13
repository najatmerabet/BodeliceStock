-- DropForeignKey
ALTER TABLE "bons_livraison" DROP CONSTRAINT "bons_livraison_client_id_fkey";

-- DropForeignKey
ALTER TABLE "bons_livraison" DROP CONSTRAINT "bons_livraison_facture_id_fkey";

-- DropForeignKey
ALTER TABLE "bons_livraison" DROP CONSTRAINT "bons_livraison_proforma_id_fkey";

-- DropForeignKey
ALTER TABLE "factures" DROP CONSTRAINT "factures_client_id_fkey";

-- DropForeignKey
ALTER TABLE "factures_avoir" DROP CONSTRAINT "factures_avoir_facture_id_fkey";

-- DropForeignKey
ALTER TABLE "factures_proforma" DROP CONSTRAINT "factures_proforma_client_id_fkey";

-- AlterTable
ALTER TABLE "lignes_bl" ADD COLUMN     "remise" DECIMAL(5,2) NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "lignes_proforma" ADD COLUMN     "nbUnites" DECIMAL(10,2),
ADD COLUMN     "poidsUnitaire" DECIMAL(10,2);

-- AddForeignKey
ALTER TABLE "bons_livraison" ADD CONSTRAINT "bons_livraison_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bons_livraison" ADD CONSTRAINT "bons_livraison_facture_id_fkey" FOREIGN KEY ("facture_id") REFERENCES "factures"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bons_livraison" ADD CONSTRAINT "bons_livraison_proforma_id_fkey" FOREIGN KEY ("proforma_id") REFERENCES "factures_proforma"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "factures_proforma" ADD CONSTRAINT "factures_proforma_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "factures" ADD CONSTRAINT "factures_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "factures_avoir" ADD CONSTRAINT "factures_avoir_facture_id_fkey" FOREIGN KEY ("facture_id") REFERENCES "factures"("id") ON DELETE CASCADE ON UPDATE CASCADE;
