#!/usr/bin/env bash
# CI-only backup and restore drill: operates on two disposable databases.
# NEVER point this script at a production database.
set -Eeuo pipefail

if [[ "${CI:-}" != "true" || "${BACKUP_DRILL_ONLY:-}" != "1" || "$(uname -s)" != "Linux" ]]; then
  echo "Refusing: backup drill must run on Linux CI with BACKUP_DRILL_ONLY=1." >&2
  exit 2
fi

source_db="vestyhub_backup_ci"
restore_db="vestyhub_restore_ci"
db_host="127.0.0.1"
db_port="5433"
db_user="vestyhub_ci"

# These fixed values are intentional, to make accidental production access impossible.
if [[ "${PGHOST:-}" != "$db_host" || "${PGPORT:-}" != "$db_port" ||
      "${PGUSER:-}" != "$db_user" || "${PGDATABASE:-}" != "$source_db" ||
      "${POSTGRES_PASSWORD:-}" != "ci-only-dummy-password" ]]; then
  echo "Refusing: expected disposable CI PostgreSQL connection parameters." >&2
  exit 2
fi

scratch="$(mktemp -d "${RUNNER_TEMP:-/tmp}/vestyhub-restore-drill.XXXXXX")"
trap 'rm -rf "$scratch"' EXIT

client() {
  docker run --rm --network host \
    -e "PGPASSWORD=$POSTGRES_PASSWORD" \
    postgres:17-alpine "$@"
}

db_psql() {
  local database="$1"
  shift
  client psql --no-psqlrc --tuples-only --no-align --set=ON_ERROR_STOP=1 \
    --host "$db_host" --port "$db_port" --username "$db_user" \
    --dbname "$database" "$@"
}

# We compare full rows (including IDs and relationships) for the core seeded tables.
# JSONB canonicalizes object keys, and aggregates are ordered to keep output stable.
read -r -d '' fingerprint_sql <<'SQL' || true
SELECT jsonb_build_object(
  'users', (SELECT coalesce(jsonb_agg(to_jsonb(t) ORDER BY t.id), '[]'::jsonb) FROM public.users t),
  'favorite_groups', (SELECT coalesce(jsonb_agg(to_jsonb(t) ORDER BY t.id), '[]'::jsonb) FROM public.favorite_groups t),
  'favorites', (SELECT coalesce(jsonb_agg(to_jsonb(t) ORDER BY t.id), '[]'::jsonb) FROM public.favorites t),
  'dashboards', (SELECT coalesce(jsonb_agg(to_jsonb(t) ORDER BY t.id), '[]'::jsonb) FROM public.dashboards t),
  'dashboard_widgets', (SELECT coalesce(jsonb_agg(to_jsonb(t) ORDER BY t.id), '[]'::jsonb) FROM public.dashboard_widgets t)
);
SQL

source_has_data="$(db_psql "$source_db" --command \
  "SELECT (SELECT count(*) FROM public.users) > 0 AND
          (SELECT count(*) FROM public.favorites) > 0 AND
          (SELECT count(*) FROM public.dashboard_widgets) > 0;")"
if [[ "$source_has_data" != "t" ]]; then
  echo "Backup drill requires a seeded disposable source DB with representative data." >&2
  exit 1
fi

source_fingerprint="$(db_psql "$source_db" --command "$fingerprint_sql" | sha256sum | cut -d' ' -f1)"

echo "Creating an ephemeral logical backup using PostgreSQL 17 client..."
docker run --rm --network host \
  -e "PGPASSWORD=$POSTGRES_PASSWORD" \
  --volume "$scratch:/backup" \
  postgres:17-alpine pg_dump \
  --host "$db_host" --port "$db_port" --username "$db_user" \
  --dbname "$source_db" --format=custom --file=/backup/vestyhub-ci.dump

if [[ ! -s "$scratch/vestyhub-ci.dump" ]]; then
  echo "Backup drill failed: dump is empty." >&2
  exit 1
fi

archive_checksum="$(sha256sum "$scratch/vestyhub-ci.dump" | cut -d' ' -f1)"
docker run --rm --volume "$scratch:/backup:ro" postgres:17-alpine \
  pg_restore --list /backup/vestyhub-ci.dump >/dev/null

# The target is created afresh; pg_restore never cleans or drops any source data.
echo "Creating independent temporary restore database..."
db_psql postgres --command "CREATE DATABASE $restore_db;" >/dev/null

echo "Restoring backup into the independent database..."
docker run --rm --network host \
  -e "PGPASSWORD=$POSTGRES_PASSWORD" \
  --volume "$scratch:/backup:ro" \
  postgres:17-alpine pg_restore \
  --exit-on-error --no-owner --no-privileges \
  --host "$db_host" --port "$db_port" --username "$db_user" \
  --dbname "$restore_db" /backup/vestyhub-ci.dump

restored_fingerprint="$(db_psql "$restore_db" --command "$fingerprint_sql" | sha256sum | cut -d' ' -f1)"
if [[ "$source_fingerprint" != "$restored_fingerprint" ]]; then
  echo "Backup drill failed: restored application data does not match source." >&2
  exit 1
fi

# Verify structure as well as records, including Drizzle's migration schema.
source_tables="$(db_psql "$source_db" --command \
  "SELECT count(*) FROM pg_catalog.pg_tables WHERE schemaname IN ('public', 'drizzle');")"
restored_tables="$(db_psql "$restore_db" --command \
  "SELECT count(*) FROM pg_catalog.pg_tables WHERE schemaname IN ('public', 'drizzle');")"
if [[ "$source_tables" != "$restored_tables" || "$restored_tables" -lt 5 ]]; then
  echo "Backup drill failed: schema table count mismatch." >&2
  exit 1
fi

echo "BACKUP_RESTORE_DRILL_OK: SHA-256 archive=$archive_checksum, tables=$restored_tables."
echo "Source and restored records match; production databases were not accessed."
