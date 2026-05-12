# dev.ps1 — Windows helper. Usage examples:
#   .\dev.ps1 db
#   .\dev.ps1 api
#   .\dev.ps1 web
#   .\dev.ps1 import
#   .\dev.ps1 seed
#   .\dev.ps1 tag
#   .\dev.ps1 clean

param(
    [Parameter(Position = 0)]
    [ValidateSet("db", "db-stop", "db-logs", "db-shell", "api", "web", "import", "seed", "tag", "clean", "help")]
    [string]$Target = "help"
)

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $MyInvocation.MyCommand.Definition
Set-Location $Root

switch ($Target) {
    "db" {
        docker compose up -d surrealdb
        Write-Host ""
        Write-Host "SurrealDB up on http://localhost:8000" -ForegroundColor Green
        Write-Host "Next: .\dev.ps1 api  (separate terminal: .\dev.ps1 web)"
    }
    "db-stop" { docker compose stop surrealdb }
    "db-logs" { docker compose logs -f --tail=100 surrealdb }
    "db-shell" {
        docker compose exec surrealdb /surreal sql `
            --conn http://localhost:8000 --user root --pass root `
            --ns rshb --db svoe_rodnoe --pretty
    }
    "api" {
        Push-Location apps/api
        try { go run ./cmd/server } finally { Pop-Location }
    }
    "web" {
        Push-Location apps/web
        try {
            if (-not (Test-Path node_modules)) {
                npm install --no-audit --no-fund --legacy-peer-deps
            }
            npm run dev
        } finally { Pop-Location }
    }
    "import" {
        Push-Location apps/api
        try { go run ./cmd/import } finally { Pop-Location }
    }
    "seed" {
        Push-Location apps/api
        try { go run ./cmd/seed } finally { Pop-Location }
    }
    "tag" {
        Push-Location apps/api
        try { go run ./cmd/tag-products } finally { Pop-Location }
    }
    "clean" {
        docker compose down -v
        Write-Host "SurrealDB volume wiped." -ForegroundColor Yellow
    }
    "help" {
        Write-Host @"
Targets:
  db          Start SurrealDB container (port 8000)
  db-stop     Stop the container
  db-logs     Tail SurrealDB logs
  db-shell    Open Surreal SQL REPL
  api         Run Go API server (port 8080)
  web         Run Vite dev server (port 5173)
  import      Import farmers_sku.xlsx
  seed        Seed event KB
  tag         Tag all SKUs (rules + Gemini)
  clean       docker compose down -v (wipe data)

Typical first run:
  .\dev.ps1 db          # Terminal 0 (background)
  .\dev.ps1 api         # Terminal A
  .\dev.ps1 web         # Terminal B
  .\dev.ps1 import      # Terminal C — one-time
  .\dev.ps1 seed        # Terminal C — one-time
  .\dev.ps1 tag         # Terminal C — one-time, needs GEMINI_API_KEY
"@
    }
}
