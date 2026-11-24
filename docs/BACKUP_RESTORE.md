# Sauvegarde et restauration

## Avertissement données

Une restauration PostgreSQL écrase ou remplace des données selon la procédure choisie. Tester le dump dans une base temporaire avant toute opération sur la production.

## Exercice automatique en CI (sans données réelles)

Le job GitHub Actions `PostgreSQL isolated backup/restore` utilise une base
PostgreSQL 17 **jetable** (`vestyhub_backup_ci`) et exécute les migrations et
le seed avec un compte de test fictif.

Le script `scripts/ci-backup-restore-drill.sh` :

1. Refuse de s'exécuter hors environnement Linux CI et hors des paramètres
   de connexion de la base jetable attendue.
2. Crée une sauvegarde logique PostgreSQL au format personnalisé
   (`pg_dump -Fc`) avec le client PostgreSQL 17 correspondant au serveur.
3. Vérifie que l'archive est non vide, calcule son **SHA-256** et fait contrôler
   sa structure par `pg_restore --list`.
4. Crée une seconde base de test distincte (`vestyhub_restore_ci`) et y
   restaure l'archive **sans `--clean`, `dropdb` ni remplacement**.
5. Compare la structure et les empreintes SHA-256 des enregistrements
   `users`, `favorite_groups`, `favorites`, `dashboards` et
   `dashboard_widgets`.

L'archive est supprimée à la fin du job et **n'est pas publiée en artifact**.
Ce test prouve la récupération des données de test dans le contexte CI ; il
**ne valide pas** à lui seul les sauvegardes, les secrets chiffrés, les volumes
ou la procédure de reprise du Synology. Ces tests restent à mener en staging
isolé lorsque le NAS sera accessible.

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
