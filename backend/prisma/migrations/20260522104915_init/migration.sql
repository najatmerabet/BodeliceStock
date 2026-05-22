-- CreateTable
CREATE TABLE "produits" (
    "id" SERIAL NOT NULL,
    "nom" TEXT NOT NULL,
    "poidsUnitaire" DECIMAL(10,2) NOT NULL DEFAULT 1,
    "prixUnitaire" DECIMAL(10,2) NOT NULL,
    "quantite" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "reference" TEXT NOT NULL,
    "unite" TEXT NOT NULL DEFAULT 'kg',
    "tva" DECIMAL(5,2) NOT NULL DEFAULT 0,

    CONSTRAINT "produits_pkey" PRIMARY KEY ("id")
);

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
CREATE TABLE "clients" (
    "id" SERIAL NOT NULL,
    "reference" TEXT,
    "nom" TEXT NOT NULL,
    "ice" TEXT,
    "telephone" TEXT,
    "adresse" TEXT,
    "codepostal" TEXT,
    "email" TEXT,
    "ville" TEXT,

    CONSTRAINT "clients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bons_livraison" (
    "id" SERIAL NOT NULL,
    "numero" TEXT NOT NULL,
    "client_id" INTEGER NOT NULL,
    "facture_id" INTEGER,
    "proforma_id" INTEGER,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "total" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "statut" TEXT NOT NULL DEFAULT 'A FACTURER',

    CONSTRAINT "bons_livraison_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lignes_bl" (
    "id" SERIAL NOT NULL,
    "bl_id" INTEGER NOT NULL,
    "produit_id" INTEGER NOT NULL,
    "nbUnites" DECIMAL(10,2),
    "poidsUnitaire" DECIMAL(10,2),
    "quantite" DECIMAL(10,2) NOT NULL,
    "prix" DECIMAL(10,2) NOT NULL,
    "total" DECIMAL(10,2) NOT NULL,
    "remise" DECIMAL(5,2) NOT NULL DEFAULT 0,

    CONSTRAINT "lignes_bl_pkey" PRIMARY KEY ("id")
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
    "nbUnites" DECIMAL(10,2),
    "poidsUnitaire" DECIMAL(10,2),
    "totalAvantRemise" DECIMAL(10,2) NOT NULL,
    "totalApresRemise" DECIMAL(10,2) NOT NULL,
    "totalTVA" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "totalTTC" DECIMAL(10,2) NOT NULL,

    CONSTRAINT "lignes_proforma_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "factures" (
    "id" SERIAL NOT NULL,
    "numero" TEXT NOT NULL,
    "client_id" INTEGER NOT NULL,
    "proforma_id" INTEGER,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "totalHT" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "totalRemise" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "totalTVA" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "total" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "paye" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "reste" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "statut" TEXT NOT NULL DEFAULT 'impayée',
    "type" TEXT NOT NULL DEFAULT 'NORMALE',
    "reference_externe" TEXT,

    CONSTRAINT "factures_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" SERIAL NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "name" TEXT,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "activitylog" (
    "id" SERIAL NOT NULL,
    "action" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entityId" INTEGER NOT NULL,
    "description" TEXT,
    "userId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "activitylog_pkey" PRIMARY KEY ("id")
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

-- CreateTable
CREATE TABLE "prix_client" (
    "id" SERIAL NOT NULL,
    "client_id" INTEGER NOT NULL,
    "produit_id" INTEGER NOT NULL,
    "prix" DECIMAL(10,2) NOT NULL,

    CONSTRAINT "prix_client_pkey" PRIMARY KEY ("id")
);

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

-- CreateTable
CREATE TABLE "client_files" (
    "id" SERIAL NOT NULL,
    "client_id" INTEGER NOT NULL,
    "folder_id" INTEGER,
    "nom" TEXT NOT NULL,
    "nomFichier" TEXT NOT NULL,
    "remarque" TEXT,
    "chemin" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "taille" INTEGER DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "client_files_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "produits_reference_key" ON "produits"("reference");

-- CreateIndex
CREATE UNIQUE INDEX "clients_reference_key" ON "clients"("reference");

-- CreateIndex
CREATE UNIQUE INDEX "bons_livraison_numero_key" ON "bons_livraison"("numero");

-- CreateIndex
CREATE UNIQUE INDEX "factures_proforma_numero_key" ON "factures_proforma"("numero");

-- CreateIndex
CREATE UNIQUE INDEX "factures_numero_key" ON "factures"("numero");

-- CreateIndex
CREATE UNIQUE INDEX "factures_proforma_id_key" ON "factures"("proforma_id");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "factures_avoir_numero_key" ON "factures_avoir"("numero");

-- CreateIndex
CREATE UNIQUE INDEX "prix_client_client_id_produit_id_key" ON "prix_client"("client_id", "produit_id");

-- AddForeignKey
ALTER TABLE "stock_mouvements" ADD CONSTRAINT "stock_mouvements_produit_id_fkey" FOREIGN KEY ("produit_id") REFERENCES "produits"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bons_livraison" ADD CONSTRAINT "bons_livraison_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bons_livraison" ADD CONSTRAINT "bons_livraison_facture_id_fkey" FOREIGN KEY ("facture_id") REFERENCES "factures"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bons_livraison" ADD CONSTRAINT "bons_livraison_proforma_id_fkey" FOREIGN KEY ("proforma_id") REFERENCES "factures_proforma"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lignes_bl" ADD CONSTRAINT "lignes_bl_bl_id_fkey" FOREIGN KEY ("bl_id") REFERENCES "bons_livraison"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lignes_bl" ADD CONSTRAINT "lignes_bl_produit_id_fkey" FOREIGN KEY ("produit_id") REFERENCES "produits"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "factures_proforma" ADD CONSTRAINT "factures_proforma_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lignes_proforma" ADD CONSTRAINT "lignes_proforma_proforma_id_fkey" FOREIGN KEY ("proforma_id") REFERENCES "factures_proforma"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lignes_proforma" ADD CONSTRAINT "lignes_proforma_produit_id_fkey" FOREIGN KEY ("produit_id") REFERENCES "produits"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "factures" ADD CONSTRAINT "factures_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "factures" ADD CONSTRAINT "factures_proforma_id_fkey" FOREIGN KEY ("proforma_id") REFERENCES "factures_proforma"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activitylog" ADD CONSTRAINT "activitylog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "factures_avoir" ADD CONSTRAINT "factures_avoir_facture_id_fkey" FOREIGN KEY ("facture_id") REFERENCES "factures"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lignes_avoir" ADD CONSTRAINT "lignes_avoir_avoir_id_fkey" FOREIGN KEY ("avoir_id") REFERENCES "factures_avoir"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lignes_avoir" ADD CONSTRAINT "lignes_avoir_produit_id_fkey" FOREIGN KEY ("produit_id") REFERENCES "produits"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "paiements" ADD CONSTRAINT "paiements_facture_id_fkey" FOREIGN KEY ("facture_id") REFERENCES "factures"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prix_client" ADD CONSTRAINT "prix_client_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prix_client" ADD CONSTRAINT "prix_client_produit_id_fkey" FOREIGN KEY ("produit_id") REFERENCES "produits"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_folders" ADD CONSTRAINT "client_folders_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_folders" ADD CONSTRAINT "client_folders_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "client_folders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_files" ADD CONSTRAINT "client_files_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_files" ADD CONSTRAINT "client_files_folder_id_fkey" FOREIGN KEY ("folder_id") REFERENCES "client_folders"("id") ON DELETE SET NULL ON UPDATE CASCADE;
