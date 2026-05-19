-- AlterTable
ALTER TABLE "client_files" ADD COLUMN     "remarque" TEXT;

-- AlterTable
ALTER TABLE "factures" ADD COLUMN     "reference_externe" TEXT,
ADD COLUMN     "type" TEXT NOT NULL DEFAULT 'NORMALE';
