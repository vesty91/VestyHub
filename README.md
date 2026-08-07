# VestyHub

VestyHub est un centre de contrôle homelab auto-hébergé pour centraliser les favoris, Docker, le NAS Synology et les sources de monitoring dans une interface sécurisée.

Le projet est actuellement en **Phase 3F**. Les fondations durcies des Phases 1 et 2 sont conservées : authentification locale, sessions persistantes, PostgreSQL, contrôle d'accès, favoris, déploiement Docker et opérations d'infrastructure en lecture seule.

## Fonctionnalités actuelles

### Fondation et sécurité

- Connexion locale avec mot de passe Argon2id.
- Sessions opaques de 7 jours : jeton aléatoire côté cookie et empreinte SHA-256 en PostgreSQL.
- Cookie `HttpOnly`, `SameSite=Lax` et `Secure` lorsque `APP_URL` utilise HTTPS.
- Rôles `ADMIN`, `USER` et `VIEWER`.
- Limitation des tentatives de connexion et journal d'audit.
- PostgreSQL 17 avec Drizzle ORM et migrations explicites.
- Healthchecks `/api/health/live` et `/api/health/ready`.
- Conteneur applicatif durci et Docker socket jamais monté directement dans l'application.

### Favoris

- Groupes, recherche, tags et épinglage.
- URL LAN/WAN et choix du mode d'ouverture.
- Création, modification et suppression.
- Sélecteur de plus de 80 icônes Lucide avec recherche, catégories et navigation clavier.

### Phase 3A — Docker NAS en lecture seule

- Connexion au moteur Docker du NAS via proxy dédié.
- Normalisation des conteneurs et métriques utiles.
- Santé, uptime, redémarrages, CPU et mémoire.
- Dashboard Docker réel et API authentifiée.
- Aucune opération start/stop/restart exposée.

### Phase 3B — Fondation UI Obsidian

- Cinq thèmes persistants : Obsidian, Midnight, Graphite, Carbon Gold et Light.
- Primitives VestyHub réutilisables.
- Sélecteur de thème accessible.
- Dashboard et shell global basés sur les tokens sémantiques du thème.

### Phase 3C — Monitoring réel

- Prometheus en lecture seule avec catalogue de métriques borné.
- Loki avec recherche limitée et requêtes LogQL construites côté serveur.
- Alertmanager en lecture seule.
- Graphiques ECharts, état des sources, logs et alertes.
- Périodes bornées `1h`, `6h`, `24h` et `7d`.

### Phase 3D — Synology DSM

- Connecteur DSM WebAPI serveur.
- Vue NAS réelle et API authentifiée.
- Gestion typée des erreurs, timeouts et validation TLS.
- Aucun secret DSM retourné au navigateur.

### Phase 3E — Synology SNMPv3

- Collecte SNMPv3 via `snmp_exporter` et Prometheus.
- Mode hybride DSM + SNMP.
- Stockage, disques, RAID et métriques matérielles Synology.
- AuthPriv avec secrets conservés hors du dépôt.

### Phase 3F — Dashboard GridStack

- Widgets déplaçables et redimensionnables sur desktop.
- Disposition persistée dans PostgreSQL.
- Grille responsive 6 colonnes desktop, 3 colonnes tablette et 1 colonne mobile.
- Sauvegarde batch authentifiée et validée avec Zod.
- La disposition mobile ne remplace pas accidentellement la disposition desktop.

Voir [Phase 3F — GridStack](docs/PHASE3F_GRIDSTACK_DASHBOARD.md).

## Prérequis

- Node.js 22 ou une version compatible avec `package.json`.
- pnpm 11 via Corepack.
- Docker Engine et Docker Compose v2 pour le déploiement recommandé.

## Nouvelle installation Docker

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

État attendu pour le socle principal :

- `postgres` : healthy ;
- `migrate` : exited avec le code 0 ;
- `app` : healthy ;
- `docker-socket-proxy` : healthy.

Le profil `monitoring` ajoute Prometheus et les services de collecte configurés dans `docker-compose.yml`.

## Mise à jour Docker du dashboard

Après une modification applicative validée :

```bash
docker compose build app
docker compose up -d --no-deps app
docker compose ps
```

Puis vérifier `/api/health/ready` et le comportement visuel du dashboard.

Lorsqu'une phase ajoute une migration SQL, exécuter également le service `migrate` conformément à la documentation de la phase concernée.

## Création du compte administrateur

Le seed reste volontaire et n'est jamais exécuté automatiquement.

1. Renseigner dans `.env` :

```env
SEED_ADMIN_EMAIL=admin@vestyhub.local
SEED_ADMIN_PASSWORD=un-mot-de-passe-long-et-unique
```

2. Exécuter :

```bash
docker compose --profile seed run --rm seed
```

3. Ouvrir l'URL configurée dans `APP_URL` et se connecter avec ce compte.

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

Validation standard :

```bash
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test:unit
pnpm build
```

Commande agrégée :

```bash
pnpm check
```

## Reverse proxy Synology DSM

Le port applicatif est publié uniquement en loopback :

```text
127.0.0.1:3000 -> app:3000
```

Dans DSM :

- source : HTTPS, domaine public, port 443 ;
- destination : HTTP, `127.0.0.1`, port 3000 ;
- certificat valide associé au domaine ;
- `APP_URL` doit correspondre exactement à l'URL HTTPS publique.

## Sécurité Docker

Le conteneur principal ne monte jamais `/var/run/docker.sock`. Un proxy séparé autorise uniquement les routes de lecture nécessaires. `POST=0` et les opérations de contrôle Docker restent désactivées.

Les connecteurs NAS et monitoring sont eux aussi conçus en lecture seule depuis l'interface VestyHub.

## Documentation

- [Architecture](docs/ARCHITECTURE.md)
- [Authentification](docs/AUTHENTICATION.md)
- [Favoris](docs/FAVORITES.md)
- [Sécurité](docs/SECURITY.md)
- [Docker](docs/DOCKER.md)
- [Synology](docs/SYNOLOGY.md)
- [Phase 3B — UI Obsidian](docs/PHASE3B_OBSIDIAN_UI.md)
- [Phase 3C — Monitoring](docs/PHASE3C_MONITORING_OBSERVABILITY.md)
- [Phase 3D — Synology NAS](docs/PHASE3D_SYNOLOGY_NAS_OBSERVABILITY.md)
- [Phase 3E — Synology SNMP](docs/PHASE3E_SYNOLOGY_SNMP_OBSERVABILITY.md)
- [Phase 3F — Dashboard GridStack](docs/PHASE3F_GRIDSTACK_DASHBOARD.md)
- [Sauvegarde et restauration](docs/BACKUP_RESTORE.md)
- [Dépannage](docs/TROUBLESHOOTING.md)

## Limites actuelles

- Authentik/OIDC n'est pas encore branché à l'interface utilisateur.
- Les opérations Docker restent volontairement en lecture seule.
- La Phase 3F personnalise la position et la taille des widgets existants ; un catalogue utilisateur complet pour ajouter/supprimer librement des widgets pourra être traité dans une phase ultérieure.
