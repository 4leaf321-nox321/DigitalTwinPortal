<#
Production-safe deploy pull script.

Features:
- Fetch latest from origin/main and reset the working tree
- Optional DB backup (uses $env:DATABASE_URL if set and pg_dump available)
- Create/activate virtualenv and install backend requirements
- Build frontend if present
- Run migrations with rollback on failure (`flask db upgrade`)
- Optional idempotent seeding script execution
- Restart Windows service and simple healthcheck

Usage:
  .\deploy_pull.ps1 -RepoPath 'C:\inetpub\wwwroot\DigitalTwinPortal' -ServiceName 'DigitalTwinPortal' -BackupDatabase -RunMigrations -RunSeed

Notes:
- Ensure `DATABASE_URL` (Postgres URI) is set in the server environment when using DB backup/restore.
- Ensure `pg_dump` and `psql` are installed/available in PATH for DB backup/restore.
#>

param(
    [string]$RepoPath = "C:\inetpub\wwwroot\DigitalTwinPortal",
    [string]$ServiceName = "",
    [switch]$BackupDatabase,
    [switch]$RunMigrations = $true,
    [switch]$RunSeed = $false,
    [int]$HealthcheckTimeoutSec = 30
)

Set-StrictMode -Version Latest

function Write-Log([string]$m) { Write-Output "[$(Get-Date -Format o)] $m" }

if (-not (Test-Path $RepoPath)) {
    Write-Error "Repo path $RepoPath not found: $RepoPath"; exit 1
}

Push-Location $RepoPath

Write-Log "Recording current HEAD"
$oldHead = git rev-parse --verify HEAD

Write-Log "Fetching origin and resetting to origin/main"
git fetch --all
try {
    git reset --hard origin/main
} catch {
    Write-Error "git reset failed: $_"; Pop-Location; exit 2
}

# Optional: backup database before migrations
if ($BackupDatabase) {
    $pgDump = "pg_dump"
    if (-not (Get-Command $pgDump -ErrorAction SilentlyContinue)) {
        Write-Warning "pg_dump not found in PATH — skipping DB backup. Install PostgreSQL client or add pg_dump to PATH to enable backups."
    } else {
        if ($env:DATABASE_URL) {
            New-Item -ItemType Directory -Path (Join-Path $RepoPath 'deploy') -Force | Out-Null
            $dumpFile = Join-Path $RepoPath "deploy\db_backup_$(Get-Date -Format yyyyMMddHHmmss).sql"
            Write-Log "Backing up database to $dumpFile"
            & $pgDump $env:DATABASE_URL -f $dumpFile
            if ($LASTEXITCODE -ne 0) { Write-Warning "pg_dump returned exit code $LASTEXITCODE" }
        } else {
            Write-Warning "DATABASE_URL environment variable not set — cannot perform pg_dump without connection info."
        }
    }
}

# Setup venv if needed
if (-not (Test-Path "$RepoPath\backend\.venv")) {
    Write-Log "Creating virtualenv for backend"
    python -m venv "$RepoPath\backend\.venv"
}

Write-Log "Activating virtualenv and installing requirements"
& "$RepoPath\backend\.venv\Scripts\Activate.ps1"
if (Test-Path "$RepoPath\backend\requirements.txt") {
    Write-Log "Installing Python requirements"
    python -m pip install --upgrade pip
    python -m pip install -r "$RepoPath\backend\requirements.txt"
} else {
    Write-Log "No backend requirements.txt found; skipping dependency install."
}

# Build frontend if present
if (Test-Path "$RepoPath\frontend\package.json") {
    Write-Log "Building frontend"
    Push-Location "$RepoPath\frontend"
    npm ci
    npm run build
    Pop-Location
} else {
    Write-Log "No frontend found; skipping frontend build."
}

# Environment: ensure production mode
Write-Log "Setting production environment flag for this deployment"
$env:FLASK_ENV = "production"
$env:APP_ENV = "production"

# Run DB migrations safely
if ($RunMigrations) {
    Write-Log "Running DB migrations (flask db upgrade)"
    try {
        Push-Location "$RepoPath\backend"
        & "$RepoPath\backend\.venv\Scripts\Activate.ps1"
        python -m flask db upgrade
        $migrateExit = $LASTEXITCODE
        Pop-Location
        if ($migrateExit -ne 0) {
            throw "Migration command exited with code $migrateExit"
        }
    } catch {
        Write-Error "Migration failed: $_"
        Write-Log "Attempting rollback to previous commit: $oldHead"
        try {
            git reset --hard $oldHead
        } catch { Write-Warning "Rollback git reset failed: $_" }
        # If a DB dump exists, attempt restore (best-effort)
        $latestDump = Get-ChildItem -Path (Join-Path $RepoPath 'deploy') -Filter 'db_backup_*.sql' -ErrorAction SilentlyContinue | Sort-Object LastWriteTime -Descending | Select-Object -First 1
        if ($latestDump) {
            if (Get-Command psql -ErrorAction SilentlyContinue) {
                Write-Log "Restoring DB from $($latestDump.FullName)"
                & psql $env:DATABASE_URL -f $latestDump.FullName
            } else { Write-Warning "psql not available to restore DB. Manual restore may be required." }
        }
        Pop-Location
        exit 10
    }
}

# Optional data seeding
if ($RunSeed) {
    $seedScript = Join-Path $RepoPath 'scripts\deploy\seed_production.ps1'
    if (Test-Path $seedScript) {
        Write-Log "Running seed script: $seedScript"
        & powershell -NoProfile -ExecutionPolicy Bypass -File $seedScript
        if ($LASTEXITCODE -ne 0) { Write-Warning "Seed script exit code: $LASTEXITCODE" }
    } else {
        Write-Warning "Seed script not found at $seedScript — skipping."
    }
}

# Restart service if specified
if ($ServiceName) {
    Write-Log "Restarting service: $ServiceName"
    try {
        Restart-Service -Name $ServiceName -Force -ErrorAction Stop
    } catch {
        Write-Warning "Failed to restart service $ServiceName: $_"
    }
}

# Healthcheck (optional simple localhost check)
if ($HealthcheckTimeoutSec -gt 0) {
    $start = Get-Date
    $ok = $false
    while ((Get-Date) -lt $start.AddSeconds($HealthcheckTimeoutSec)) {
        try {
            $r = Invoke-WebRequest -Uri 'http://127.0.0.1:5000/health' -UseBasicParsing -TimeoutSec 5
            if ($r.StatusCode -eq 200) { $ok = $true; break }
        } catch { Start-Sleep -Seconds 2 }
    }
    if ($ok) { Write-Log "Health check passed." } else { Write-Warning "Health check failed or timed out." }
}

Write-Log "Deploy pull complete."
Pop-Location
