/*
  Warnings:

  - You are about to drop the column `cleint_id` on the `client_files` table. All the data in the column will be lost.
  - Added the required column `client_id` to the `client_files` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "client_files" DROP CONSTRAINT "client_files_cleint_id_fkey";

-- AlterTable
ALTER TABLE "client_files" DROP COLUMN "cleint_id",
ADD COLUMN     "client_id" INTEGER NOT NULL,
ADD COLUMN     "folder_id" INTEGER,
ADD COLUMN     "taille" INTEGER DEFAULT 0;

-- CreateTable
CREATE TABLE "client_folders" (
    "id" SERIAL NOT NULL,
    "client_id" INTEGER NOT NULL,
    "parent_id" INTEGER,
    "nom" TEXT NOT NULL,
    "couleur" TEXT NOT NULL DEFAULT '#6B7280',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "client_folders_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "client_folders" ADD CONSTRAINT "client_folders_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_folders" ADD CONSTRAINT "client_folders_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "client_folders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_files" ADD CONSTRAINT "client_files_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_files" ADD CONSTRAINT "client_files_folder_id_fkey" FOREIGN KEY ("folder_id") REFERENCES "client_folders"("id") ON DELETE SET NULL ON UPDATE CASCADE;
