# VestyHub

VestyHub est un centre de contrôle homelab auto-hébergé pour centraliser les favoris, Docker, le NAS Synology et les sources de monitoring.

Cette archive correspond à la **Phase 2.1** : la fondation durcie de la Phase 1 est conservée, avec une authentification locale, des sessions persistantes, un shell de dashboard, une gestion complète des favoris et une page Docker en lecture seule.

## Fonctionnalités Phase 2

- Connexion locale avec mot de passe Argon2id.
- Sessions opaques de 7 jours : jeton aléatoire côté cookie et empreinte SHA-256 en PostgreSQL.
- Cookie `HttpOnly`, `SameSite=Lax` et `Secure` lorsque `APP_URL` utilise HTTPS.
- Rôles `ADMIN`, `USER` et `VIEWER`.
- Limitation des tentatives de connexion et journal d’audit.
- Dashboard responsive avec sidebar, thème clair/sombre et widgets persistés.
- Widgets initiaux : horloge, favoris et statut général.
- Gestion des favoris : groupes, recherche, tags, URL LAN/WAN, épinglage, création, modification et suppression.
- Sélecteur visuel de plus de 80 icônes Lucide, avec recherche, catégories, aperçu et navigation clavier.
- Inventaire Docker réel via le socket proxy strictement en lecture seule.
- Pages de préparation NAS et monitoring.
- PostgreSQL 17, Drizzle ORM, migrations one-shot et seed explicite.
- Healthchecks : `/api/health/live` et `/api/health/ready`.

## Prérequis

- Node.js 24 ou une version compatible avec `package.json`.
- pnpm 11 via Corepack.
- Docker Engine et Docker Compose v2 pour le déploiement recommandé.

## Installation Docker

### Mise à jour depuis la Phase 1

Conserver le fichier `.env` et le volume PostgreSQL existants, puis exécuter sous Windows :

```powershell
.\scripts\deploy-phase2.ps1
```

Ne jamais utiliser `docker compose down -v` pendant la mise à jour.

### Nouvelle installation

```bash
cp .env.example .env
# Renseigner les secrets et mots de passe.
docker compose config
docker compose build --no-cache
docker compose up -d --remove-orphans
```

Vérification :

```bash
docker compose ps -a
docker compose logs --tail=100 migrate app postgres
curl -fsS http://127.0.0.1:3000/api/health/live
curl -fsS http://127.0.0.1:3000/api/health/ready
```

L’état attendu est :

- `postgres` : healthy ;
- `migrate` : exited avec le code 0 ;
- `app` : healthy ;
- `docker-socket-proxy` : healthy.

## Création du compte administrateur

Le seed reste volontaire et n’est jamais exécuté automatiquement.

1. Renseigner dans `.env` :

```env
SEED_ADMIN_EMAIL=admin@vestyhub.local
SEED_ADMIN_PASSWORD=un-mot-de-passe-long-et-unique
```

2. Exécuter :

```bash
docker compose --profile seed run --rm seed
```

3. Ouvrir `http://127.0.0.1:3000` et se connecter avec ce compte.

Si le compte existe déjà, le seed ne remplace pas silencieusement son mot de passe.

## Développement local

```bash
corepack enable
pnpm install --frozen-lockfile
cp .env.example .env.local
pnpm db:migrate
pnpm dev
```

## Validation

Windows PowerShell :

```powershell
Set-ExecutionPolicy -Scope Process Bypass
.\scripts\validate-phase2.ps1
```

Linux, macOS ou DSM :

```bash
./scripts/validate-phase2.sh
```

La validation exécute : Prettier, ESLint, TypeScript, Vitest, le build Next.js et `docker compose config` lorsque Docker est présent.

## Reverse proxy Synology DSM

Le port est publié uniquement en loopback :

```text
127.0.0.1:3000 -> app:3000
```

Dans DSM :

- source : HTTPS, domaine public, port 443 ;
- destination : HTTP, `127.0.0.1`, port 3000 ;
- certificat valide associé au domaine ;
- `APP_URL` doit correspondre exactement à l’URL HTTPS publique.

## Sécurité Docker

Le conteneur principal ne monte jamais `/var/run/docker.sock`. Un proxy séparé autorise uniquement les routes de lecture nécessaires. `POST=0` et toutes les actions start/stop/restart restent désactivées.

## Documentation

- [Architecture](docs/ARCHITECTURE.md)
- [Authentification](docs/AUTHENTICATION.md)
- [Favoris](docs/FAVORITES.md)
- [Validation Phase 2](docs/PHASE2_VALIDATION.md)
- [Rapport Phase 2](docs/PHASE2_REPORT.md)
- [Rapport Phase 2.1 — icônes](docs/PHASE2_1_REPORT.md)
- [Validation Phase 2.1](docs/PHASE2_1_VALIDATION.md)
- [Sécurité](docs/SECURITY.md)
- [Docker](docs/DOCKER.md)
- [Synology](docs/SYNOLOGY.md)
- [Sauvegarde et restauration](docs/BACKUP_RESTORE.md)
- [Dépannage](docs/TROUBLESHOOTING.md)

## Limites actuelles

- Authentik/OIDC n’est pas encore branché à l’interface.
- La disposition des widgets est lue depuis PostgreSQL, mais le drag-and-drop GridStack sera activé dans la phase suivante.
- Le connecteur Synology et les graphiques Prometheus/Loki restent à implémenter.
- Aucune action Docker d’écriture n’est exposée.
