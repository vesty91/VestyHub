#!/usr/bin/env sh
set -eu

run() {
  printf '\n==> %s\n' "$1"
  shift
  "$@"
}

run "Installation verrouillée" pnpm install --frozen-lockfile
run "Prettier" pnpm format:check
run "ESLint" pnpm lint
run "TypeScript" pnpm typecheck
run "Tests unitaires" pnpm test:unit
run "Build Next.js" pnpm build

if command -v docker >/dev/null 2>&1; then
  run "Validation Docker Compose" docker compose config --quiet
else
  printf '\nAVERTISSEMENT : Docker absent, validation Compose non exécutée.\n' >&2
fi

printf '\nValidation Phase 1 terminée.\n'
