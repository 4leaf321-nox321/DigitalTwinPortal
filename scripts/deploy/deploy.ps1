<#
Deploy a release to a fixed operating folder.

Replaces the numbered-folder scheme (digitaltwinportal11, 12, ...) with one
stable path plus a single previous copy for rollback:

    <AppPath>          the folder you always run from
    <AppPath>_prev     the version replaced by the last deploy

No virtualenv is created. The release package ships every dependency under
site-packages, and run_server.ps1 puts it on PYTHONPATH, so the server needs
no pip install and no internet access.

Stop the running app before deploying; Windows locks files that are in use.

Usage:
  .\deploy.ps1 -AppPath 'C:\apps\DigitalTwinPortal'
  .\deploy.ps1 -AppPath 'C:\apps\DigitalTwinPortal' -Tag v0.1.9
  .\deploy.ps1 -AppPath 'C:\apps\DigitalTwinPortal' -ZipPath 'C:\tmp\deploy_package.zip'
  .\deploy.ps1 -AppPath 'C:\apps\DigitalTwinPortal' -SkipMigrations
#>

param(
    [Parameter(Mandatory = $true)][string]$AppPath,
    [string]$Repo = '4leaf321-nox321/DigitalTwinPortal',
    [string]$Tag,
    [string]$ZipPath,
    [switch]$SkipMigrations
)

$ErrorActionPreference = 'Stop'
function Write-Log([string]$m) { Write-Host "[$(Get-Date -Format 'HH:mm:ss')] $m" }

$prevPath    = $AppPath + '_prev'
$stagingPath = $AppPath + '_staging'
$isFirstRun  = -not (Test-Path $AppPath)

if ($isFirstRun) { Write-Log "No existing install at $AppPath - treating as first deploy" }

# Refuse to run while files are locked, rather than half-replacing the folder.
if (-not $isFirstRun) {
    $lockProbe = Join-Path $AppPath ('.deploy_lock_probe_' + [guid]::NewGuid().ToString('N'))
    try {
        New-Item -ItemType File -Path $lockProbe -Force | Out-Null
        Remove-Item -Force $lockProbe
    } catch {
        throw "Cannot write to $AppPath. Close the running app and any shell sitting in that folder, then retry."
    }
}

# --- obtain the release zip -------------------------------------------------
$tempZipDir = $null
if (-not $ZipPath) {
    if (-not (Get-Command gh -ErrorAction SilentlyContinue)) {
        throw "gh CLI not found. Install it and run 'gh auth login' (this repo is private), or pass -ZipPath."
    }
    $tempZipDir = Join-Path $env:TEMP ('dtp_zip_' + [guid]::NewGuid().ToString('N'))
    New-Item -ItemType Directory -Force -Path $tempZipDir | Out-Null
    $ghArgs = @('release', 'download')
    if ($Tag) { $ghArgs += $Tag }
    $ghArgs += @('--repo', $Repo, '--pattern', 'deploy_package.zip', '--dir', $tempZipDir)
    Write-Log 'Downloading release asset'
    & gh @ghArgs
    if ($LASTEXITCODE -ne 0) { throw "gh release download failed (exit $LASTEXITCODE)" }
    $ZipPath = Join-Path $tempZipDir 'deploy_package.zip'
}
if (-not (Test-Path $ZipPath)) { throw "Zip not found: $ZipPath" }

# --- extract to staging and sanity-check before touching the live folder -----
if (Test-Path $stagingPath) { Remove-Item -Recurse -Force $stagingPath }
Write-Log "Extracting to $stagingPath"
Expand-Archive -Path $ZipPath -DestinationPath $stagingPath -Force
if ($tempZipDir) { Remove-Item -Recurse -Force $tempZipDir }

$stagedSitePackages = Join-Path $stagingPath 'site-packages'
foreach ($mod in @('werkzeug', 'itsdangerous', 'blinker', 'alembic', 'flask')) {
    if (-not (Get-ChildItem -Path $stagedSitePackages -Filter $mod -Force -ErrorAction SilentlyContinue)) {
        Remove-Item -Recurse -Force $stagingPath
        throw "Package is missing '$mod' in site-packages. Aborting before the live folder is touched."
    }
}
Write-Log 'Package dependency check passed'

# The bundled wheels carry ABI tags tied to the Python that built them, so a
# minor-version mismatch fails at import time with an unhelpful error. Catch it
# here, while the live folder is still untouched.
$serverPython = & python -c "import sys; print('{}.{}'.format(sys.version_info[0], sys.version_info[1]))"
if ($LASTEXITCODE -ne 0) {
    Remove-Item -Recurse -Force $stagingPath
    throw "Could not run python. Make sure it is installed and on PATH."
}
$buildInfoPath = Join-Path $stagingPath 'BUILD_INFO.txt'
if (Test-Path $buildInfoPath) {
    $buildPython = ((Get-Content $buildInfoPath | Where-Object { $_ -match '^python=' }) -replace '^python=', '').Trim()
    if ($buildPython -and $buildPython -ne $serverPython) {
        Remove-Item -Recurse -Force $stagingPath
        Write-Host ''
        Write-Host "  This server's Python : $serverPython"
        Write-Host "  Package was built on : $buildPython"
        Write-Host ''
        Write-Host "  Set python-version to '$serverPython' in .github/workflows/release-windows.yml"
        Write-Host "  and ci-windows.yml, then cut a new release."
        Write-Host ''
        throw "Python version mismatch. Nothing was changed on this server."
    }
    Write-Log "Python version matches ($serverPython)"
} else {
    Write-Warning "Package has no BUILD_INFO.txt (built before version stamping). This server runs Python $serverPython."
}

# --- swap ------------------------------------------------------------------
if (-not $isFirstRun) {
    if (Test-Path $prevPath) { Write-Log 'Removing the older backup'; Remove-Item -Recurse -Force $prevPath }
    Write-Log "Moving current install to $prevPath"
    Move-Item -Force $AppPath $prevPath
}
Write-Log "Promoting staging to $AppPath"
Move-Item -Force $stagingPath $AppPath

# --- carry over state the package deliberately does not ship ----------------
# uploads and .env are untracked, so they are absent from the zip by design.
if (-not $isFirstRun) {
    $carry = @(
        @{ Name = 'uploads'; From = (Join-Path $prevPath 'backend\uploads'); To = (Join-Path $AppPath 'backend\uploads') },
        @{ Name = '.env';    From = (Join-Path $prevPath 'backend\.env');    To = (Join-Path $AppPath 'backend\.env') }
    )
    foreach ($item in $carry) {
        if (Test-Path $item.From) {
            Write-Log "Carrying over $($item.Name)"
            $parent = Split-Path -Parent $item.To
            if (-not (Test-Path $parent)) { New-Item -ItemType Directory -Force -Path $parent | Out-Null }
            Copy-Item -Recurse -Force $item.From $item.To
        } else {
            Write-Warning "$($item.Name) not found at $($item.From); the new install will not have it."
        }
    }
}

if (-not (Test-Path (Join-Path $AppPath 'backend\.env'))) {
    Write-Warning "backend\.env is missing. Migrations and startup need DATABASE_URL - create it before continuing."
}

# --- migrations -------------------------------------------------------------
if ($SkipMigrations) {
    Write-Log 'Skipping migrations as requested'
} else {
    Write-Log 'Running database migrations'
    $backend = Join-Path $AppPath 'backend'
    Push-Location $backend
    try {
        $env:PYTHONPATH = (Join-Path $AppPath 'site-packages')
        $env:FLASK_APP = 'run.py'
        & python -m flask db upgrade
        if ($LASTEXITCODE -ne 0) { throw "flask db upgrade failed (exit $LASTEXITCODE)" }
        Write-Log 'Migrations applied'
    } catch {
        Pop-Location
        Write-Error "Migration failed: $_"
        Write-Host ''
        Write-Host "The new code is in place but the database may be partly migrated."
        Write-Host "To roll the files back:  .\rollback.ps1 -AppPath '$AppPath'"
        exit 10
    }
    Pop-Location
}

Write-Log 'Deploy complete'
Write-Host ''
Write-Host "Start the app with:"
Write-Host "  cd '$AppPath'"
Write-Host "  .\run_server.ps1"
Write-Host ''
Write-Host "Previous version kept at $prevPath (rollback: .\rollback.ps1 -AppPath '$AppPath')"
