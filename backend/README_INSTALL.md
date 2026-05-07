# 🏭 Guide d'Installation — Bôdélice ProdMeat Stock

## Prérequis à installer

| Outil | Version | Lien |
|---|---|---|
| **Node.js** | v18 ou plus | https://nodejs.org |
| **PostgreSQL** | v14 ou plus | https://www.postgresql.org/download/ |
| **Git** | dernière version | https://git-scm.com |

---

## Étape 1 — Cloner le projet

```bash
git clone https://github.com/najatmerabet/BodeliceStock.git
cd BodeliceStock
```

---

## Étape 2 — Installer PostgreSQL

### Sur Mac (Homebrew)
```bash
brew install postgresql@16
brew services start postgresql@16
```

### Sur Windows
1. Télécharger l'installateur : https://www.postgresql.org/download/windows/
2. Lancer l'installation, retenir le **mot de passe** choisi pour l'utilisateur `postgres`
3. PostgreSQL démarre automatiquement

### Sur Linux (Ubuntu/Debian)
```bash
sudo apt update
sudo apt install postgresql postgresql-contrib
sudo systemctl start postgresql
sudo systemctl enable postgresql
```

---

## Étape 3 — Créer la base de données

### Sur Mac
```bash
createdb prodmeatstock
```

### Sur Windows (ouvrir PowerShell ou cmd)
```bash
psql -U postgres
```
Puis dans le shell psql :
```sql
CREATE DATABASE prodmeatstock;
\q
```

### Sur Linux
```bash
sudo -u postgres createdb prodmeatstock
```

---

## Étape 4 — Configurer le Backend

```bash
cd backend
cp .env.example .env
```

Ouvre le fichier `.env` et modifie la ligne `DATABASE_URL` :

### Sur Mac (Homebrew, pas de mot de passe)
```
DATABASE_URL="postgresql://TON_NOM_UTILISATEUR@localhost:5432/prodmeatstock"
```
> Remplace `TON_NOM_UTILISATEUR` par ton nom d'utilisateur Mac (tape `whoami` dans le terminal pour le trouver)

### Sur Windows / Linux
```
DATABASE_URL="postgresql://postgres:TON_MOT_DE_PASSE@localhost:5432/prodmeatstock"
```
> Remplace `TON_MOT_DE_PASSE` par le mot de passe choisi lors de l'installation de PostgreSQL

---

## Étape 5 — Installer les dépendances Backend

```bash
npm install
```

---

## Étape 6 — Générer Prisma Client + Migrer la base

```bash
npx prisma generate
npx prisma migrate dev --name init
```

> ✅ Cette commande va créer toutes les tables automatiquement :
> - `produits`
> - `clients`
> - `bons_livraison`
> - `lignes_bl`
> - `factures`

---

## Étape 7 — Remplir la base avec les données initiales

```bash
npm run prisma:seed
```

> ✅ Résultat attendu :
> ```
> 🌱 Seeding database...
> ✅ 20 produits créés
> ✅ 5 clients créés
> 🎉 Seed terminé !
> ```

---

## Étape 8 — Lancer le serveur Backend

```bash
npm run dev
```

> ✅ Tu verras : `🚀 Serveur démarré sur http://localhost:3000`

### Vérifier que ça marche
Ouvre dans ton navigateur : http://localhost:3000/api/produits

Tu dois voir la liste des 20 produits en JSON.

---

## Étape 9 — Installer et lancer le Frontend

Ouvre un **nouveau terminal** :

```bash
cd BodeliceStock/frontend
npm install
npm run start
```

> ✅ Le frontend démarre sur http://localhost:4200

---

## Résumé des commandes (copier-coller)

```bash
# 1. Cloner
git clone https://github.com/najatmerabet/BodeliceStock.git
cd BodeliceStock

# 2. Créer la base (Mac)
createdb prodmeatstock

# 3. Backend
cd backend
cp .env.example .env
# ⚠️ Modifier .env avec ton DATABASE_URL
npm install
npx prisma generate
npx prisma migrate dev --name init
npm run prisma:seed
npm run dev

# 4. Frontend (nouveau terminal)
cd BodeliceStock/frontend
npm install
npm run start
```

---

## ❓ Problèmes courants

| Erreur | Solution |
|---|---|
| `role "postgres" does not exist` | Sur Mac, utilise ton nom d'utilisateur au lieu de `postgres` |
| `database "prodmeatstock" does not exist` | Tu n'as pas fait l'étape 3. Crée la base d'abord |
| `Connection refused` | PostgreSQL n'est pas démarré. Lance-le avec `brew services start postgresql` (Mac) ou `sudo systemctl start postgresql` (Linux) |
| `EACCES permission denied` | Utilise `sudo` devant la commande (Linux uniquement) |
