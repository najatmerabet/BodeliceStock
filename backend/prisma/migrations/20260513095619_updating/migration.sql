-- AlterTable
ALTER TABLE "lignes_bl" ADD COLUMN     "remise" DECIMAL(5,2) NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "lignes_proforma" ADD COLUMN     "nbUnites" DECIMAL(10,2),
ADD COLUMN     "poidsUnitaire" DECIMAL(10,2);
