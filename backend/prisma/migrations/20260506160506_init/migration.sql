-- CreateTable
CREATE TABLE "produits" (
    "id" SERIAL NOT NULL,
    "nom" TEXT NOT NULL,
    "prix" DECIMAL(10,2) NOT NULL,
    "stock" DECIMAL(10,2) NOT NULL DEFAULT 0,

    CONSTRAINT "produits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "clients" (
    "id" SERIAL NOT NULL,
    "nom" TEXT NOT NULL,
    "telephone" TEXT,
    "adresse" TEXT,

    CONSTRAINT "clients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bons_livraison" (
    "id" SERIAL NOT NULL,
    "numero" TEXT NOT NULL,
    "client_id" INTEGER NOT NULL,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "total" DECIMAL(10,2) NOT NULL DEFAULT 0,

    CONSTRAINT "bons_livraison_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lignes_bl" (
    "id" SERIAL NOT NULL,
    "bl_id" INTEGER NOT NULL,
    "produit_id" INTEGER NOT NULL,
    "quantite" DECIMAL(10,2) NOT NULL,
    "prix" DECIMAL(10,2) NOT NULL,
    "total" DECIMAL(10,2) NOT NULL,

    CONSTRAINT "lignes_bl_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "factures" (
    "id" SERIAL NOT NULL,
    "numero" TEXT NOT NULL,
    "client_id" INTEGER NOT NULL,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "total" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "paye" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "reste" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "statut" TEXT NOT NULL DEFAULT 'impayée',

    CONSTRAINT "factures_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "bons_livraison_numero_key" ON "bons_livraison"("numero");

-- CreateIndex
CREATE UNIQUE INDEX "factures_numero_key" ON "factures"("numero");

-- AddForeignKey
ALTER TABLE "bons_livraison" ADD CONSTRAINT "bons_livraison_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lignes_bl" ADD CONSTRAINT "lignes_bl_bl_id_fkey" FOREIGN KEY ("bl_id") REFERENCES "bons_livraison"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lignes_bl" ADD CONSTRAINT "lignes_bl_produit_id_fkey" FOREIGN KEY ("produit_id") REFERENCES "produits"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "factures" ADD CONSTRAINT "factures_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
