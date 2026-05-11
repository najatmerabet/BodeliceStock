-- AlterTable
ALTER TABLE "bons_livraison" ADD COLUMN     "facture_id" INTEGER,
ADD COLUMN     "statut" TEXT NOT NULL DEFAULT 'A FACTURER';

-- AddForeignKey
ALTER TABLE "bons_livraison" ADD CONSTRAINT "bons_livraison_facture_id_fkey" FOREIGN KEY ("facture_id") REFERENCES "factures"("id") ON DELETE SET NULL ON UPDATE CASCADE;
