#!/bin/sh

set -eu

PROJECT="/volume1/docker/vestyhub-nas-deploy"
PROJECT_NAME="vestyhub-nas-deploy"

BASE="$PROJECT/docker-compose.yml"
OVERRIDE="$PROJECT/docker-compose.override.yml"
ENV_FILE="$PROJECT/.env"

ACTIVE="$PROJECT/deploy/nas/compose.production.yml"
STAGED="${1:-$PROJECT/deploy/nas/compose.production.next.yml}"

NTFY_SECRET="$PROJECT/secrets/ntfy-alertmanager.runtime.token"

BACKUP_ROOT="/var/services/homes/Vesty/vestyhub-backups"
STAMP=$(date +%Y%m%d-%H%M%S)
BACKUP="$BACKUP_ROOT/phase3p-$STAMP"

DOCKER=""

APPLIED=0
SUCCESS=0
HAD_ACTIVE=0
MIGRATION_ATTEMPTED=0

DEPLOY_SERVICES="
postgres
migrate
app
cadvisor
node-exporter
snmp-exporter
prometheus
loki
alloy
alertmanager
ntfy
"

RUNNING_SERVICES="
postgres
app
cadvisor
node-exporter
snmp-exporter
prometheus
loki
alloy
alertmanager
ntfy
"

log() {
    printf '\n=== %s ===\n' "$1"
}

die() {
    echo "ERREUR: $*" >&2
    exit 1
}

find_docker() {
    for candidate in \
        /usr/local/bin/docker \
        /var/packages/ContainerManager/target/usr/bin/docker \
        /var/packages/Docker/target/usr/bin/docker
    do
        if [ -x "$candidate" ]; then
            DOCKER="$candidate"
            return 0
        fi
    done

    return 1
}

legacy_compose() {
    "$DOCKER" compose \
        -p "$PROJECT_NAME" \
        --project-directory "$PROJECT" \
        -f "$BASE" \
        -f "$OVERRIDE" \
        "$@"
}

candidate_compose() {
    "$DOCKER" compose \
        -p "$PROJECT_NAME" \
        --project-directory "$PROJECT" \
        -f "$STAGED" \
        "$@"
}

active_compose() {
    "$DOCKER" compose \
        -p "$PROJECT_NAME" \
        --project-directory "$PROJECT" \
        -f "$ACTIVE" \
        "$@"
}

rollback() {
    log "ROLLBACK PHASE 3P"

    set +e

    # Une migration peut modifier le schéma avant même d'échouer.
    # Dans ce cas, remettre automatiquement une ancienne application
    # peut être incompatible avec la base.
    if [ "$MIGRATION_ATTEMPTED" = "1" ]; then
        echo "ATTENTION: une migration a pu modifier PostgreSQL."
        echo "Rollback applicatif automatique BLOQUE par securite."
        echo
        echo "Le manifeste actif et les conteneurs sont conserves"
        echo "pour diagnostic."
        echo
        echo "Backup avant deploiement :"
        echo "$BACKUP"

        if [ -f "$BACKUP/postgres-before.dump" ]; then
            echo
            echo "Dump PostgreSQL disponible :"
            echo "$BACKUP/postgres-before.dump"
        fi

        return 0
    fi

    if [ "$HAD_ACTIVE" = "1" ] &&
       [ -f "$BACKUP/compose.production.yml" ]; then

        cp "$BACKUP/compose.production.yml" "$ACTIVE"

        echo "Ancienne baseline restauree."

        active_compose up -d --no-build \
            postgres \
            migrate \
            app \
            cadvisor \
            node-exporter \
            snmp-exporter \
            prometheus \
            loki \
            alloy \
            alertmanager \
            ntfy
    else
        rm -f "$ACTIVE"

        echo "Retour au couple docker-compose.yml + override."

        legacy_compose up -d --no-build \
            postgres \
            migrate \
            app \
            cadvisor \
            node-exporter \
            snmp-exporter \
            prometheus \
            loki \
            alloy \
            alertmanager \
            ntfy
    fi

    echo
    echo "Rollback conteneurs/configuration termine."
    echo "Le dump PostgreSQL n'est PAS restaure automatiquement."

    if [ -f "$BACKUP/postgres-before.dump" ]; then
        echo "Dump PostgreSQL disponible :"
        echo "$BACKUP/postgres-before.dump"
    fi
}

on_exit() {
    rc=$?

    trap - EXIT INT TERM

    if [ "$APPLIED" = "1" ] &&
       [ "$SUCCESS" != "1" ]; then
        rollback
    fi

    exit "$rc"
}

trap on_exit EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

# ============================================================
# PREFLIGHT
# ============================================================

log "PREFLIGHT"

find_docker || die "Docker introuvable"

echo "Docker=$DOCKER"

cd "$PROJECT"

test -f "$BASE" ||
    die "docker-compose.yml absent"

test -f "$OVERRIDE" ||
    die "docker-compose.override.yml absent"

test -f "$ENV_FILE" ||
    die ".env absent"

test -f "$STAGED" ||
    die "manifeste staging absent : $STAGED"

test -s "$NTFY_SECRET" ||
    die "secret ntfy absent ou vide"

grep -qx 'name: vestyhub-nas-deploy' "$STAGED" ||
    die "nom de projet Compose incorrect"

# Configs runtime indispensables
for file in \
    "$PROJECT/deploy/alertmanager/alertmanager.yml" \
    "$PROJECT/deploy/alloy/config.alloy" \
    "$PROJECT/deploy/loki/config.yml" \
    "$PROJECT/deploy/ntfy/server.yml" \
    "$PROJECT/deploy/prometheus/prometheus.yml" \
    "$PROJECT/deploy/prometheus/alerts.yml" \
    "$PROJECT/deploy/snmp-exporter/auth.yml"
do
    test -f "$file" ||
        die "configuration runtime absente : $file"
done

# Réseau Docker externe déjà existant.
"$DOCKER" network inspect \
    vestyhub-docker-proxy_default \
    >/dev/null 2>&1 ||
    die "reseau vestyhub-docker-proxy_default absent"

echo "Preflight fichiers/reseau OK."

# ============================================================
# VALIDATION COMPOSE
# ============================================================

log "VALIDATION COMPOSE STAGING"

candidate_compose config --quiet

echo "Compose staging valide."

# ============================================================
# SERVICES
# ============================================================

log "SERVICES"

SERVICES=$(candidate_compose config --services)

for required in \
    postgres \
    migrate \
    app \
    cadvisor \
    node-exporter \
    snmp-exporter \
    prometheus \
    loki \
    alloy \
    alertmanager \
    ntfy
do
    echo "$SERVICES" |
        grep -qx "$required" ||
        die "service obligatoire absent : $required"
done

echo "Services obligatoires OK."

# Seed volontairement exclu du déploiement normal.
if echo "$DEPLOY_SERVICES" | grep -qx "seed"; then
    die "seed ne doit jamais etre deploye automatiquement"
fi

echo "seed=EXCLU"

# ============================================================
# IMAGES
# ============================================================

log "IMAGES LOCALES"

IMAGES=$(candidate_compose config --images | sort -u)

for image in $IMAGES
do
    echo "Verification : $image"

    "$DOCKER" image inspect "$image" \
        >/dev/null 2>&1 ||
        die "image Docker absente : $image"
done

echo "Toutes les images sont presentes localement."

# ============================================================
# BACKUP
# ============================================================

log "BACKUP"

mkdir -p "$BACKUP"
chmod 700 "$BACKUP"

cp "$BASE" "$BACKUP/docker-compose.yml"
cp "$OVERRIDE" "$BACKUP/docker-compose.override.yml"

if [ -f "$ACTIVE" ]; then
    HAD_ACTIVE=1
    cp "$ACTIVE" "$BACKUP/compose.production.yml"
fi

# Backup .env sans jamais afficher son contenu.
cp "$ENV_FILE" "$BACKUP/runtime.env"
chmod 600 "$BACKUP/runtime.env"

echo "Backup configuration : $BACKUP"

# ============================================================
# BACKUP POSTGRES
# ============================================================

log "BACKUP POSTGRES"

POSTGRES_CID=$(legacy_compose ps -q postgres)

test -n "$POSTGRES_CID" ||
    die "conteneur PostgreSQL introuvable"

POSTGRES_RUNNING=$(
    "$DOCKER" inspect \
        --format '{{.State.Running}}' \
        "$POSTGRES_CID"
)

[ "$POSTGRES_RUNNING" = "true" ] ||
    die "PostgreSQL n'est pas running"

"$DOCKER" exec "$POSTGRES_CID" \
    sh -lc \
    'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc' \
    > "$BACKUP/postgres-before.dump"

test -s "$BACKUP/postgres-before.dump" ||
    die "dump PostgreSQL vide"

chmod 600 "$BACKUP/postgres-before.dump"

echo "Dump PostgreSQL OK."
echo "$BACKUP/postgres-before.dump"

# ============================================================
# INSTALLATION ATOMIQUE DU MANIFESTE
# ============================================================

log "INSTALLATION MANIFESTE"

cp "$STAGED" "$ACTIVE.next"

chmod 644 "$ACTIVE.next"

mv "$ACTIVE.next" "$ACTIVE"

APPLIED=1

active_compose config --quiet

echo "Baseline active installee."

# ============================================================
# DEPLOIEMENT
# ============================================================

log "DEPLOIEMENT"

# A partir d'ici, Compose peut lancer le service migrate.
# Tout rollback automatique vers une ancienne application devient
# potentiellement dangereux pour le schéma PostgreSQL.
MIGRATION_ATTEMPTED=1

active_compose up -d --no-build \
    postgres \
    migrate \
    app \
    cadvisor \
    node-exporter \
    snmp-exporter \
    prometheus \
    loki \
    alloy \
    alertmanager \
    ntfy

# ============================================================
# MIGRATION
# ============================================================

log "VERIFICATION MIGRATION"

MIGRATION_OK=0
i=1

while [ "$i" -le 60 ]
do
    MIGRATE_CID=$(active_compose ps -a -q migrate || true)

    if [ -n "$MIGRATE_CID" ]; then
        RUNNING=$(
            "$DOCKER" inspect \
                --format '{{.State.Running}}' \
                "$MIGRATE_CID"
        )

        EXIT_CODE=$(
            "$DOCKER" inspect \
                --format '{{.State.ExitCode}}' \
                "$MIGRATE_CID"
        )

        if [ "$RUNNING" = "false" ]; then
            if [ "$EXIT_CODE" = "0" ]; then
                MIGRATION_OK=1
                break
            fi

            die "migration echouee : exit=$EXIT_CODE"
        fi
    fi

    sleep 2
    i=$((i + 1))
done

[ "$MIGRATION_OK" = "1" ] ||
    die "timeout migration"

echo "Migration OK."

# ============================================================
# CONTENEURS RUNNING
# ============================================================

log "CONTENEURS RUNNING"

for service in $RUNNING_SERVICES
do
    CID=$(active_compose ps -q "$service")

    test -n "$CID" ||
        die "conteneur absent : $service"

    RUNNING=$(
        "$DOCKER" inspect \
            --format '{{.State.Running}}' \
            "$CID"
    )

    [ "$RUNNING" = "true" ] ||
        die "conteneur non running : $service"

    echo "$service=RUNNING"
done

# ============================================================
# HEALTHCHECK APP
# ============================================================

log "HEALTHCHECK APP"

APP_CID=$(active_compose ps -q app)

APP_HEALTH=0
i=1

while [ "$i" -le 60 ]
do
    STATUS=$(
        "$DOCKER" inspect \
            --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}' \
            "$APP_CID"
    )

    echo "app health=$STATUS"

    if [ "$STATUS" = "healthy" ]; then
        APP_HEALTH=1
        break
    fi

    if [ "$STATUS" = "unhealthy" ]; then
        die "app unhealthy"
    fi

    sleep 2
    i=$((i + 1))
done

[ "$APP_HEALTH" = "1" ] ||
    die "timeout healthcheck app"

# ============================================================
# HEALTHCHECK NTFY
# ============================================================

log "HEALTHCHECK NTFY"

NTFY_CID=$(active_compose ps -q ntfy)

NTFY_HEALTH=0
i=1

while [ "$i" -le 60 ]
do
    STATUS=$(
        "$DOCKER" inspect \
            --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}' \
            "$NTFY_CID"
    )

    echo "ntfy health=$STATUS"

    if [ "$STATUS" = "healthy" ]; then
        NTFY_HEALTH=1
        break
    fi

    if [ "$STATUS" = "unhealthy" ]; then
        die "ntfy unhealthy"
    fi

    sleep 2
    i=$((i + 1))
done

[ "$NTFY_HEALTH" = "1" ] ||
    die "timeout healthcheck ntfy"

# ============================================================
# READY OBSERVABILITE
# ============================================================

log "READY OBSERVABILITE"

OBS_OK=0
i=1

while [ "$i" -le 30 ]
do
    if "$DOCKER" exec "$APP_CID" node - <<'NODE'
(async () => {
  const urls = [
    "http://prometheus:9090/-/ready",
    "http://alertmanager:9093/-/ready",
    "http://loki:3100/ready",
    "http://ntfy:80/v1/health",
  ];

  for (const url of urls) {
    const response = await fetch(url);

    if (!response.ok) {
      console.error(url, response.status);
      process.exit(1);
    }
  }
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
NODE
    then
        OBS_OK=1
        break
    fi

    sleep 2
    i=$((i + 1))
done

[ "$OBS_OK" = "1" ] ||
    die "services d'observabilite non ready"

echo "Observabilite READY."

# ============================================================
# ETAT FINAL
# ============================================================

log "ETAT FINAL"

active_compose ps

SUCCESS=1

trap - EXIT INT TERM

echo
echo "=========================================="
echo "=== PHASE 3P DEPLOIEMENT REUSSI ==="
echo "=========================================="
echo
echo "Backup : $BACKUP"