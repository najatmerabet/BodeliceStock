# Guide CI/CD avec GitHub Actions

## ÉTAPE 1 : Créer un compte Docker Hub (si pas déjà fait)

1. Va sur https://hub.docker.com
2. Créer un compte gratuit
3. Note ton username

---

## ÉTAPE 2 : Créer un Access Token sur Docker Hub

1. Connecte-toi sur https://hub.docker.com
2. Clique sur ton profil → Account Settings → Security
3. New Access Token
4. Copie le token (tu ne pourras plus le revoir)

---

## ÉTAPE 3 : Générer une clé SSH sur le SERVEUR

SSH sur ton serveur, puis :

```bash
# Générer la clé
ssh-keygen -t ed25519 -C "github-actions" -f ~/.ssh/github_actions

# Afficher la clé publique (à copier)
cat ~/.ssh/github_actions.pub

# Ajouter au authorized_keys
cat ~/.ssh/github_actions.pub >> ~/.ssh/authorized_keys
```

---

## ÉTAPE 4 : Configurer les Secrets sur GitHub

1. Va sur GitHub → ton projet → Settings → Secrets and variables → Actions
2. Clique "New repository secret" et ajoute :

| Secret Name | Value |
|-------------|-------|
| `DOCKERHUB_USERNAME` | Ton username Docker Hub |
| `DOCKERHUB_TOKEN` | Le token Docker Hub |
| `SERVER_IP` | IP de ton serveur (ex: 192.168.1.100) |
| `SERVER_USER` | Nom d'utilisateur sur le serveur |
| `SERVER_SSH_KEY` | **Copie tout le contenu de** `~/.ssh/github_actions` (clé privée) |

---

## ÉTAPE 5 : Configurer le serveur

Assure-toi que Docker et docker-compose sont installés sur le serveur :

```bash
# Vérifier
docker --version
docker-compose --version

# Si pas installé, installer Docker
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER

# Installer docker-compose
sudo curl -L "https://github.com/docker/compose/releases/download/v2.24.0/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose
```

---

## ÉTAPE 6 : Cloner le projet sur le serveur

```bash
# Sur le serveur, cloner ou mettre à jour le projet
cd ~
git clone https://github.com/TON_USER/PRODMEATSTOCK.git
# ou si déjà cloné :
cd PRODMEATSTOCK
git pull origin main
```

---

## ÉTAPE 7 : Tester le déploiement

1. Sur ton ordi, modifie un fichier et push :
```bash
git add .
git commit -m "test deployment"
git push origin main
```

2. Va sur GitHub → Actions pour voir le pipeline tourner

3. Sur le serveur, vérifie :
```bash
docker-compose ps
docker-compose logs -f
```

---

## COMMANDES UTILES

```bash
# Sur le serveur
docker-compose logs -f        # Voir les logs en temps réel
docker-compose restart        # Redémarrer
docker-compose down           # Arrêter tout
docker-compose pull           # Mettre à jour les images

# SSH pour debug
ssh user@IP_DU_SERVEUR

# Voir les containers
docker ps
```

---

## RÉSUMÉ DU WORKFLOW

```
Tu push sur GitHub (main)
        │
        ▼
GitHub Actions se déclenche
        │
        ├── Build backend → Push vers Docker Hub
        │
        ├── Build frontend → Push vers Docker Hub
        │
        └── SSH sur serveur
              ├── git pull
              ├── docker-compose pull
              └── docker-compose up -d --build
```

---

## SI ÇA NE MARCHE PAS

### Erreur SSH :
```bash
# Vérifier que la clé SSH fonctionne
ssh -i ~/.ssh/github_actions user@IP_DU_SERVEUR
```

### Vérifier les logs :
```bash
# Sur GitHub : Actions → workflows → Voir les logs
# Sur le serveur : docker-compose logs -f
```

### Redémarrer le runner si Self-hosted (optionnel) :
```bash
cd ~/actions-runner && ./run.sh
```