# VestyHub

[![Version](https://img.shields.io/badge/version-v0.4.0-blue)](https://github.com/vesty91/VestyHub/releases/tag/v0.4.0) [![CI](https://github.com/vesty91/VestyHub/actions/workflows/ci.yml/badge.svg)](https://github.com/vesty91/VestyHub/actions/workflows/ci.yml) [![Audit](https://github.com/vesty91/VestyHub/actions/workflows/dependency-audit.yml/badge.svg)](https://github.com/vesty91/VestyHub/actions/workflows/dependency-audit.yml)

**Centre de contrôle homelab auto-hébergé** : favoris, Docker, NAS Synology, monitoring et diagnostic Windows réunis dans une interface sécurisée.

La version **v0.4.0**, publiée le 24 novembre 2026, consolide les développements précédents via la PR #45. Le code et les tests sont validés ; le déploiement sur le NAS cible reste à qualifier.

[Release v0.4.0](https://github.com/vesty91/VestyHub/releases/tag/v0.4.0) · [Notes de livraison](docs/RELEASE-v0.4.0.md) · [Feuille de route](docs/ROADMAP.md)

## Fonctionnalités

| Module        | Capacités                                                                                      |
| ------------- | ---------------------------------------------------------------------------------------------- |
| Dashboard     | Widgets GridStack, disposition persistée, affichage responsive, thèmes                         |
| Favoris       | Groupes, tags, recherche, épinglage, URL LAN/WAN, CRUD, vérification de disponibilité protégée |
| Docker        | Inventaire, santé, CPU/RAM, logs selon configuration, contrôle administrateur optionnel        |
| Synology      | DSM WebAPI, SNMPv3, stockage, disques, RAID, métriques                                         |
| Monitoring    | Prometheus, Loki, Alertmanager, graphiques ECharts                                             |
| Windows local | CPU, RAM, stockage, services, top 5 processus RAM, historique 5 minutes, seuils                |
| Résilience    | Timeouts HTTP, circuit breakers, distinction panne/non-configuré, reprise PostgreSQL           |

### Sécurité et authentification

- Argon2id, sessions opaques de 7 jours et empreinte SHA-256 stockée dans PostgreSQL.
- Cookies HttpOnly, SameSite=Lax et Secure sous HTTPS.
- Rôles ADMIN, USER et VIEWER, limitation des connexions et journal d'audit.
- Contrôle des URL de favoris contre les destinations interdites ; isolation des droits testée.
- Docker socket jamais monté directement dans l'application ; contrôle Docker désactivé par défaut, réservé aux administrateurs et soumis à un proxy d'écriture approprié.
- Conteneur applicatif durci, secrets hors dépôt, DSM et monitoring en lecture seule.
- Dernier audit de la v0.4.0 : 0 critique, 0 élevée, 1 modérée (minimatch), 0 faible. Voir le [rapport de sécurité](docs/release-v0.4.0-security.md). Ce résultat est daté et ne garantit pas l'absence de nouvelles alertes.

### Dashboard et interface

- Cinq thèmes : Obsidian, Midnight, Graphite, Carbon Gold et Light.
- Widgets déplaçables et redimensionnables sur desktop, grille responsive et sauvegarde authentifiée.
- Historique local CPU/RAM limité à cinq minutes dans l'onglet ; seuils configurables et confirmation sur mesures distinctes.
- Top 5 des processus Windows en lecture seule, disponible uniquement en développement local Windows.
- Les connecteurs non configurés ne sont pas présentés comme des incidents.

## Stack technique

| Couche         | Technologies                                                        |
| -------------- | ------------------------------------------------------------------- |
| Frontend       | Next.js 16.4.6, React 19.2.4, TypeScript, Tailwind CSS 4, shadcn/ui |
| Données        | PostgreSQL 17, Drizzle ORM, Zod                                     |
| Interface      | GridStack, ECharts, Lucide, Zustand, TanStack Query                 |
| Infrastructure | Docker Compose, DSM, SNMPv3, Prometheus, Loki, Alloy, Alertmanager  |
| Qualité        | pnpm 11.18.0, ESLint, Prettier, Vitest, Playwright, GitHub Actions  |

## Démarrage local Windows

Prérequis : Node.js 22+ (Node 24 utilisé en CI), Corepack/pnpm et Docker Desktop démarré pour PostgreSQL. Utiliser un environnement de développement dédié, jamais la base de production.

Dans CMD, à la racine du dépôt :

```bat
node scripts\setup-local-env.mjs
pnpm install --frozen-lockfile
docker compose --env-file .env.local -f compose.local.yml config --quiet
scripts\start-local.cmd
```

- Application : http://127.0.0.1:3200
- PostgreSQL local : 127.0.0.1:15432
- Projet Compose : vestyhub-windows-local

Le script de démarrage applique les migrations et le seed sur la base locale. Consulter [Windows local](docs/LOCAL_WINDOWS.md) avant la première exécution. Ne jamais publier le contenu de .env.local.

## Installation Docker (nouvelle instance)

Sur un hôte Linux dédié, depuis un checkout de la version souhaitée :

```bash
cp .env.example .env
# Configurer les secrets, URL, mots de passe et paramètres de l'instance.
docker compose config --quiet
docker compose build
docker compose up -d
docker compose ps -a
```

Ne pas écraser un fichier .env existant. Vérifier que le projet Compose ne désigne pas une instance existante avant le démarrage. Le profil monitoring ajoute les services de collecte.

### Administrateur initial

Configurer SEED_ADMIN_EMAIL et SEED_ADMIN_PASSWORD dans .env avec un mot de passe unique, puis lancer volontairement :

```bash
docker compose --profile seed run --rm seed
```

Le seed ne remplace pas le mot de passe d'un compte existant.

### Vérification

```bash
curl -fsS http://127.0.0.1:3000/api/health/live
curl -fsS http://127.0.0.1:3000/api/health/ready
docker compose logs --tail=100 migrate app postgres
```

Adapter le port au manifeste utilisé. PostgreSQL et app doivent être healthy ; migrate doit sortir avec le code 0.

## NAS, reverse proxy et mises à jour

Les images de la release sont à construire depuis le tag v0.4.0 : vestyhub:v0.4.0 et vestyhub-tools:v0.4.0. Le tag est configurable via VESTYHUB_IMAGE_TAG.

Le Compose standard publie par défaut sur 127.0.0.1:3000. Le manifeste NAS publie sur VESTYHUB_BIND_IP (loopback par défaut), port 3001. Pour un reverse proxy externe, choisir explicitement une adresse accessible et filtrée ; ne pas exposer PostgreSQL ou le Docker socket. APP_URL doit correspondre à l'URL HTTPS publique.

**Avant toute mise à jour d'une instance existante :** vérifier le projet Compose, les volumes, les images, les secrets, les migrations, le dump PostgreSQL et sa restauration isolée. Conserver les anciennes images et une procédure de retour arrière. Ne jamais utiliser down --volumes pour une mise à jour.

Le manifeste NAS et son script de déploiement nécessitent une qualification spécifique sur le NAS cible ; ne pas les exécuter aveuglément.

## Tests et validation

```bash
pnpm check
pnpm audit --prod
```

La CI de la PR #45 a validé 239 tests unitaires (60 fichiers), le build, Playwright desktop/mobile, les manifestes NAS, la sauvegarde/restauration et la reprise PostgreSQL sur des instances jetables. Les tests E2E doivent utiliser une base jetable, jamais une base réelle.

## Documentation

- [Architecture](docs/ARCHITECTURE.md) · [Développement](docs/DEVELOPMENT.md) · [Windows local](docs/LOCAL_WINDOWS.md)
- [Authentification](docs/AUTHENTICATION.md) · [Sécurité](docs/SECURITY.md) · [Favoris](docs/FAVORITES.md)
- [Docker](docs/DOCKER.md) · [Synology](docs/SYNOLOGY.md) · [Monitoring](docs/PHASE3C_MONITORING_OBSERVABILITY.md)
- [Dashboard GridStack](docs/PHASE3F_GRIDSTACK_DASHBOARD.md) · [SNMP](docs/PHASE3E_SYNOLOGY_SNMP_OBSERVABILITY.md) · [UI Obsidian](docs/PHASE3B_OBSIDIAN_UI.md)
- [Sauvegarde/restauration](docs/BACKUP_RESTORE.md) · [Dépannage](docs/TROUBLESHOOTING.md)
- [Sécurité v0.4.0](docs/release-v0.4.0-security.md) · [Release](docs/RELEASE-v0.4.0.md) · [Roadmap](docs/ROADMAP.md)

## Suite du projet — v0.5.0

Priorités : qualifier les images et le staging NAS, renforcer l'observabilité et l'ergonomie, traiter l'alerte modérée résiduelle et poursuivre les tests de résilience. Authentik/OIDC n'est pas encore intégré à l'interface. Le contrôle Docker réel doit être qualifié avant activation. La v0.4.0 est publiée, mais la validation sur le NAS cible n'est pas acquise.

---

**Restor-PC · VestyHub**
