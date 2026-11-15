@echo off
setlocal
cd /d "%~dp0.."

if not exist ".env.local" (
  echo [VestyHub] Initializing local configuration...
  node scripts\setup-local-env.mjs || exit /b 1
)

docker info >nul 2>&1
if errorlevel 1 (
  echo [VestyHub] Docker Desktop is not running.
  echo Start Docker Desktop first, then relaunch this script.
  exit /b 1
)

echo [VestyHub] Starting isolated PostgreSQL...
docker compose --env-file .env.local -f compose.local.yml up -d postgres || exit /b 1

echo [VestyHub] Applying database migrations...
call pnpm db:migrate || exit /b 1
call pnpm db:seed || exit /b 1

curl.exe --silent --fail http://127.0.0.1:3200/api/health/live >nul 2>&1
if not errorlevel 1 (
  echo [VestyHub] Already running: http://127.0.0.1:3200
  exit /b 0
)

echo [VestyHub] Starting Next.js on http://127.0.0.1:3200
start "VestyHub Local Dev" cmd /k "cd /d %CD% && pnpm exec next dev --hostname 127.0.0.1 --port 3200"
exit /b 0
