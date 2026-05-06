# 🏭 Installation ProdMeat Stock (Backend)

Pour installer la base de données sur ton PC :

### 1. Prérequis
- Node.js (v18+)
- PostgreSQL installé

### 2. Configuration
1. Copie le fichier `.env.example` vers `.env`
2. Modifie la ligne `DATABASE_URL` avec tes accès PostgreSQL :
   `DATABASE_URL="postgresql://TON_USER:TON_PASSWORD@localhost:5432/prodmeatstock"`

### 3. Création de la Database
Ouvre un terminal et tape :
```bash
# Si tu es sur Mac (Homebrew)
createdb prodmeatstock

# OU via le shell psql
psql -U postgres -c "CREATE DATABASE prodmeatstock;"
```

### 4. Initialisation du projet
```bash
cd backend
npm install
npx prisma generate
npx prisma migrate dev --name init
npm run prisma:seed
```

### 5. Lancer le serveur
```bash
npm run dev
```
