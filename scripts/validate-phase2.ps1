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

$temporaryEnvironment = @{}
$defaults = @{
    NODE_ENV = "test"
    APP_NAME = "VestyHub"
    APP_URL = "http://127.0.0.1:3000"
    APP_PORT = "3000"
    APP_ENCRYPTION_KEY = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
    AUTH_SECRET = "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"
    DATABASE_URL = "postgresql://vestyhub:validation@127.0.0.1:5432/vestyhub"
    POSTGRES_PASSWORD = "validation-only"
    AUTH_LOCAL_ENABLED = "true"
    AUTHENTIK_ENABLED = "false"
    DOCKER_CONTROL_ENABLED = "false"
    DOCKER_LOGS_ENABLED = "true"
    SYNOLOGY_ENABLED = "false"
    SYNOLOGY_VERIFY_TLS = "true"
    DEMO_MODE = "false"
}

foreach ($entry in $defaults.GetEnumerator()) {
    $existing = [Environment]::GetEnvironmentVariable($entry.Key, "Process")
    if ([string]::IsNullOrWhiteSpace($existing)) {
        $temporaryEnvironment[$entry.Key] = $true
        [Environment]::SetEnvironmentVariable($entry.Key, $entry.Value, "Process")
    }
}

try {
    Invoke-Step "Installation verrouillee" { pnpm install --frozen-lockfile }
    Invoke-Step "Prettier" { pnpm format:check }
    Invoke-Step "ESLint" { pnpm lint }
    Invoke-Step "TypeScript" { pnpm typecheck }
    Invoke-Step "Tests unitaires" { pnpm test:unit }
    Invoke-Step "Build Next.js" { pnpm build }

    if (Get-Command docker -ErrorAction SilentlyContinue) {
        Invoke-Step "Validation Docker Compose" { docker compose config --quiet }
        Write-Host "`nPour le test d'integration complet :" -ForegroundColor Yellow
        Write-Host "  docker compose build --no-cache"
        Write-Host "  docker compose up -d --remove-orphans"
        Write-Host "  docker compose --profile seed run --rm seed"
    } else {
        Write-Warning "Docker est absent : docker compose config n'a pas ete execute."
    }

    Write-Host "`nValidation Phase 2 terminee." -ForegroundColor Green
}
finally {
    foreach ($key in $temporaryEnvironment.Keys) {
        [Environment]::SetEnvironmentVariable($key, $null, "Process")
    }
}
