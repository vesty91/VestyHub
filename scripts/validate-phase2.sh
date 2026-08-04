#!/usr/bin/env sh
set -eu

export NODE_ENV="${NODE_ENV:-test}"
export APP_NAME="${APP_NAME:-VestyHub}"
export APP_URL="${APP_URL:-http://127.0.0.1:3000}"
export APP_PORT="${APP_PORT:-3000}"
export APP_ENCRYPTION_KEY="${APP_ENCRYPTION_KEY:-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa}"
export AUTH_SECRET="${AUTH_SECRET:-bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb}"
export DATABASE_URL="${DATABASE_URL:-postgresql://vestyhub:validation@127.0.0.1:5432/vestyhub}"
export POSTGRES_PASSWORD="${POSTGRES_PASSWORD:-validation-only}"
export AUTH_LOCAL_ENABLED="${AUTH_LOCAL_ENABLED:-true}"
export AUTHENTIK_ENABLED="${AUTHENTIK_ENABLED:-false}"
export DOCKER_CONTROL_ENABLED="false"
export DOCKER_LOGS_ENABLED="${DOCKER_LOGS_ENABLED:-true}"
export SYNOLOGY_ENABLED="${SYNOLOGY_ENABLED:-false}"
export SYNOLOGY_VERIFY_TLS="${SYNOLOGY_VERIFY_TLS:-true}"
export DEMO_MODE="${DEMO_MODE:-false}"

pnpm install --frozen-lockfile
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test:unit
pnpm build

if command -v docker >/dev/null 2>&1; then
  docker compose config --quiet
fi

echo "Validation Phase 2 terminee."
