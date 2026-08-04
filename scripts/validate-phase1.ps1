$ErrorActionPreference = "Stop"

function Invoke-Step {
    param(
        [Parameter(Mandatory = $true)][string]$Name,
        [Parameter(Mandatory = $true)][scriptblock]$Command
    )

    Write-Host "`n==> $Name" -ForegroundColor Cyan
    & $Command
    if ($LASTEXITCODE -ne 0) {
        throw "Echec de l'etape '$Name' (code $LASTEXITCODE)."
    }
}

Invoke-Step "Installation verrouillee" { pnpm install --frozen-lockfile }
Invoke-Step "Prettier" { pnpm format:check }
Invoke-Step "ESLint" { pnpm lint }
Invoke-Step "TypeScript" { pnpm typecheck }
Invoke-Step "Tests unitaires" { pnpm test:unit }
Invoke-Step "Build Next.js" { pnpm build }

if (Get-Command docker -ErrorAction SilentlyContinue) {
    Invoke-Step "Validation Docker Compose" { docker compose config --quiet }
    Write-Host "`nDocker est disponible. Les tests d'integration restent volontaires :" -ForegroundColor Yellow
    Write-Host "  docker compose build --no-cache"
    Write-Host "  docker compose up -d postgres"
    Write-Host "  docker compose run --rm migrate"
    Write-Host "  docker compose up -d app"
} else {
    Write-Warning "Docker est absent : docker compose config n'a pas été execute."
}

Write-Host "`nValidation Phase 1 terminee." -ForegroundColor Green
