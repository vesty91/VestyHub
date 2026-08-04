#!/usr/bin/env sh
set -eu

if [ ! -f .env ]; then
  echo "Le fichier .env est absent. Copiez celui de la Phase 1 ou partez de .env.example." >&2
  exit 1
fi

command -v docker >/dev/null 2>&1 || {
  echo "Docker est introuvable." >&2
  exit 1
}

docker compose config --quiet
docker compose build --no-cache
docker compose up -d --remove-orphans
sleep 10
docker compose ps -a
curl -fsS http://127.0.0.1:3000/api/health/live
printf '\n'
curl -fsS http://127.0.0.1:3000/api/health/ready
printf '\nPhase 2 deployee. Aucun volume n\047a ete supprime.\n'
