# Sauvegarde et restauration

## Avertissement données

Une restauration PostgreSQL écrase ou remplace des données selon la procédure choisie. Tester le dump dans une base temporaire avant toute opération sur la production.

## Sauvegarde PostgreSQL

```bash
mkdir -p backups
docker compose exec -T postgres pg_dump \
  -U "${POSTGRES_USER:-vestyhub}" \
  -d "${POSTGRES_DB:-vestyhub}" \
  -Fc > "backups/vestyhub-$(date +%Y%m%d-%H%M%S).dump"
```

Vérification structurelle :

```bash
pg_restore --list backups/vestyhub-AAAAmmjj-HHMMSS.dump > /dev/null
```

## Fichiers à sauvegarder

- dump PostgreSQL ;
- `.env` via un coffre sécurisé, jamais dans l’archive du code ;
- éventuels certificats CA internes ;
- icônes et fichiers persistants ajoutés en Phase 2 ;
- version exacte du code et des images déployées.

## Test de restauration isolé

1. Créer une base temporaire.
2. Restaurer le dump sans toucher à la base active.
3. Exécuter les requêtes de contrôle.
4. Lancer VestyHub avec une `DATABASE_URL` temporaire.
5. Vérifier `/api/health/ready` et les données.

## Restauration

Arrêter l’application avant une restauration complète :

```bash
docker compose stop app
docker compose exec -T postgres dropdb -U "${POSTGRES_USER:-vestyhub}" --if-exists vestyhub
docker compose exec -T postgres createdb -U "${POSTGRES_USER:-vestyhub}" vestyhub
cat backups/vestyhub.dump | docker compose exec -T postgres \
  pg_restore -U "${POSTGRES_USER:-vestyhub}" -d vestyhub --clean --if-exists
docker compose up -d app
```

Adapter les noms de base et utilisateur à `.env`. Cette procédure est destructive ; conserver le dump antérieur et une copie hors du NAS.
