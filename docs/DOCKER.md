# Docker

## Services principaux

| Service               | Fonction                    | Port hôte               |
| --------------------- | --------------------------- | ----------------------- |
| `postgres`            | Base de données             | Aucun                   |
| `migrate`             | Migration one-shot          | Aucun                   |
| `app`                 | Next.js standalone          | `127.0.0.1:${APP_PORT}` |
| `seed`                | Initialisation volontaire   | Aucun                   |
| `docker-socket-proxy` | Docker API en lecture seule | Aucun                   |

## Commandes sûres

```bash
docker compose config
docker compose build --no-cache
docker compose up -d
docker compose ps
docker compose logs --tail=100 migrate app postgres
```

## Migrations seules

```bash
docker compose up -d postgres
docker compose run --rm migrate
```

## Seed seul

```bash
docker compose --profile seed run --rm seed
```

## État du connecteur Docker NAS

La source Docker du NAS est **optionnelle** :

- Si `DOCKER_PROXY_URL` n’est pas renseigné, le tableau de bord indique
  **« Non configuré »** (état neutre) et n’effectue aucune requête Docker.
  La page Docker n’actualise pas automatiquement cette source désactivée.
- Si un proxy est configuré mais inaccessible, l’état est **« Indisponible »**
  avec un bouton de réessai. Ce cas reste une anomalie à diagnostiquer.
- Si le proxy répond et que l’identité de l’hôte correspond aux attentes,
  les métriques réelles sont affichées.

Cette distinction n’active aucun contrôle Docker et n’ajoute aucun accès réseau.
Une modification de variables d’environnement nécessite de redémarrer
l’application pour recharger la configuration du serveur.

## Proxy Docker

Le service autorise uniquement les sections de lecture utiles, avec `POST=0`. Les opérations `exec`, build, secrets, swarm, services et plugins restent bloquées.

**Risque critique :** ne jamais ajouter `ports:` au service `docker-socket-proxy`. Ne jamais pointer `DOCKER_PROXY_URL` vers une API Docker TCP exposée sur le LAN.

## Monitoring optionnel

```bash
docker compose --profile monitoring up -d
```

Les données sont persistées dans les volumes nommés :

- `prometheus_data`
- `loki_data`
- `alloy_data`
- `alertmanager_data`

Le profil monte des chemins hôte nécessaires à node_exporter, cAdvisor et Alloy. Vérifier leur compatibilité avec DSM avant activation.

## Mise à jour

```bash
# 1. Sauvegarde vérifiée
docker compose exec -T postgres pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc > vestyhub-before-update.dump

# 2. Construction
docker compose build --no-cache

# 3. Migration et redémarrage
docker compose up -d

# 4. Contrôles
docker compose ps
curl -fsS http://127.0.0.1:${APP_PORT:-3000}/api/health/ready
```

## Retour arrière

Un retour arrière applicatif n’implique pas automatiquement un retour arrière de schéma. Restaurer l’ancienne image uniquement si ses migrations sont compatibles. Sinon, restaurer le dump PostgreSQL dans une base isolée, valider, puis basculer.
