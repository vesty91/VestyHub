@echo off
setlocal
cd /d "%~dp0.."
if not exist ".env.local" (
  echo [VestyHub] .env.local is missing, no local database configured.
  exit /b 1
)
echo [VestyHub] Stopping ONLY VestyHub local PostgreSQL...
docker compose --env-file .env.local -f compose.local.yml stop postgres
echo [VestyHub] Volume kept intact. Stop Next.js with Ctrl+C in its terminal.
exit /b 0
