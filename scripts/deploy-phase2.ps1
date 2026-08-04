param(
    [switch]$Seed
)

$ErrorActionPreference = "Stop"

if (-not (Test-Path ".env")) {
    throw "Le fichier .env est absent. Copie celui de la Phase 1 ou pars de .env.example."
}

if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
    throw "Docker est introuvable. Demarre Docker Desktop ou execute ce script sur l'hote Docker."
}

Write-Host "==> Validation Compose" -ForegroundColor Cyan
docker compose config --quiet
if ($LASTEXITCODE -ne 0) {
    throw "La configuration Docker Compose est invalide."
}

Write-Host "==> Construction Phase 2" -ForegroundColor Cyan
docker compose build --no-cache
if ($LASTEXITCODE -ne 0) {
    throw "La construction Docker a echoue."
}

Write-Host "==> Demarrage sans suppression des volumes" -ForegroundColor Cyan
docker compose up -d --remove-orphans
if ($LASTEXITCODE -ne 0) {
    throw "Le demarrage Docker Compose a echoue."
}

if ($Seed) {
    Write-Host "==> Seed explicite" -ForegroundColor Cyan
    docker compose --profile seed run --rm seed
    if ($LASTEXITCODE -ne 0) {
        throw "Le seed a echoue."
    }
}

Start-Sleep -Seconds 10

docker compose ps -a

Write-Host "==> Healthchecks" -ForegroundColor Cyan
$live = Invoke-RestMethod "http://127.0.0.1:3000/api/health/live"
$ready = Invoke-RestMethod "http://127.0.0.1:3000/api/health/ready"

Write-Host "Liveness : $($live.status)" -ForegroundColor Green
Write-Host "Readiness: $($ready.status)" -ForegroundColor Green
Write-Host "Phase 2 deployee. Aucun volume n'a ete supprime." -ForegroundColor Green
