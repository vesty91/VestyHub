# Déploiement Synology DSM 7

## Préparation

1. Installer Container Manager.
2. Copier le projet dans un dossier dédié, par exemple `/volume1/docker/vestyhub`.
3. Copier `.env.example` vers `.env`.
4. Générer des secrets uniques et modifier les mots de passe.
5. Vérifier les droits du dossier : seuls les administrateurs Docker doivent pouvoir lire `.env`.

## Démarrage SSH

```bash
cd /volume1/docker/vestyhub
docker compose config
docker compose build --no-cache
docker compose up -d
docker compose ps
```

Le service applicatif écoute uniquement sur `127.0.0.1:3000`. Il n’est donc pas directement accessible depuis le LAN.

## Reverse proxy DSM

Dans **Panneau de configuration > Portail de connexion > Avancé > Proxy inversé** :

1. Créer une règle.
2. Source : `HTTPS`, nom d’hôte du dashboard, port `443`.
3. Destination : `HTTP`, `127.0.0.1`, port `3000`.
4. Dans les en-têtes personnalisés, activer les en-têtes WebSocket si la future Phase 2 les utilise.
5. Associer le certificat au nom d’hôte dans **Sécurité > Certificat > Paramètres**.

Dans `.env` :

```env
APP_URL=https://dashboard.example.com
APP_PORT=3000
```

## Vérifications

```bash
curl -fsS http://127.0.0.1:3000/api/health/live
curl -fsS http://127.0.0.1:3000/api/health/ready
docker compose logs --tail=100 migrate app postgres
```

## Connecteur DSM futur

Créer un compte DSM dédié en lecture seule. Ne pas utiliser le compte administrateur principal. Conserver `SYNOLOGY_VERIFY_TLS=true` et monter une CA interne si nécessaire.

## Particularités DS920+

Avant d’activer le profil monitoring fourni, vérifier les chemins Docker réels de DSM. Si Prometheus, Loki ou Grafana existent déjà, ne déployer aucun doublon : renseigner seulement leurs URL dans `.env`.
