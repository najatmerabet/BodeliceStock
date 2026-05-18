-- CreateTable
CREATE TABLE "client_files" (
    "id" SERIAL NOT NULL,
    "cleint_id" INTEGER NOT NULL,
    "nom" TEXT NOT NULL,
    "nomFichier" TEXT NOT NULL,
    "chemin" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "client_files_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "client_files" ADD CONSTRAINT "client_files_cleint_id_fkey" FOREIGN KEY ("cleint_id") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;
