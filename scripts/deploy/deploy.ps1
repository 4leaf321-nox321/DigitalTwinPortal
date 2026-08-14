<#
Deploy a release to a fixed operating folder.

Replaces the numbered-folder scheme (digitaltwinportal11, 12, ...) with one
stable path, a single previous copy for rollback, and virtualenvs that outlive
both:

    <AppPath>                    the folder you always run from
    <AppPath>_prev               the version replaced by the last deploy
    <AppPath>_venvs\backend      rebuilt only when requirements.txt changes
    <AppPath>_venvs\mcp_server

Dependencies install from the wheel bundle shipped in the package
(`pip install --no-index`), so a deploy never depends on the network being
able to reach PyPI.

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
    [string]$PythonExe,
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

foreach ($component in @('backend', 'mcp_server')) {
    $req = Join-Path $stagingPath "$component\requirements.txt"
    if (-not (Test-Path $req)) { continue }
    $wheelDir = Join-Path $stagingPath "$component\packages"
    $wheels = Get-ChildItem -Path $wheelDir -Filter '*.whl' -ErrorAction SilentlyContinue
    if (-not $wheels) {
        Remove-Item -Recurse -Force $stagingPath
        throw "Package has no wheel bundle for $component. Aborting before the live folder is touched."
    }
    Write-Log "$component wheel bundle: $($wheels.Count) wheels"
}

# The backend serves the SPA from frontend/dist. Without it every page returns
# the API's JSON 404, which looks like a routing bug rather than a bad package.
$stagedIndex = Join-Path $stagingPath 'frontend\dist\index.html'
if (-not (Test-Path $stagedIndex)) {
    Remove-Item -Recurse -Force $stagingPath
    throw "Package has no frontend\dist\index.html. Aborting before the live folder is touched."
}
Write-Log 'Frontend present'

# The bundled wheels carry ABI tags tied to the Python that built them, so a
# minor-version mismatch fails at install time. Catch it here, while the live
# folder is still untouched.
#
# Do not assume PATH's python is the right one: a server can have a newer
# python first on PATH while the app is meant to run on an older one. Ask the
# py launcher for the exact version the package declares, and fall back to
# PATH only when that is unavailable.
$buildInfoPath = Join-Path $stagingPath 'BUILD_INFO.txt'
$buildPython = $null
if (Test-Path $buildInfoPath) {
    $buildPython = ((Get-Content $buildInfoPath | Where-Object { $_ -match '^python=' }) -replace '^python=', '').Trim()
}

$pythonExe = $null
if ($PythonExe) {
    $pythonExe = $PythonExe
    Write-Log "Using the interpreter given by -PythonExe: $pythonExe"
} elseif ($buildPython) {
    try {
        $resolved = & py "-$buildPython" -c "import sys; print(sys.executable)" 2>$null
        if ($LASTEXITCODE -eq 0 -and $resolved) {
            $pythonExe = $resolved.Trim()
            Write-Log "Using Python $buildPython via the py launcher: $pythonExe"
        }
    } catch {
        # py launcher absent or has no such version; fall through to PATH
    }
}
if (-not $pythonExe) { $pythonExe = 'python' }

try {
    $serverPython = & $pythonExe -c "import sys; print('{}.{}'.format(sys.version_info[0], sys.version_info[1]))"
} catch {
    Remove-Item -Recurse -Force $stagingPath
    throw "Could not run '$pythonExe'. Make sure Python is installed and on PATH, or pass -PythonExe."
}
if ($LASTEXITCODE -ne 0) {
    Remove-Item -Recurse -Force $stagingPath
    throw "Could not run '$pythonExe'. Make sure Python is installed and on PATH, or pass -PythonExe."
}

if ($buildPython) {
    if ($buildPython -ne $serverPython) {
        Remove-Item -Recurse -Force $stagingPath
        Write-Host ''
        Write-Host "  Interpreter used     : $pythonExe"
        Write-Host "  Its version          : $serverPython"
        Write-Host "  Package was built on : $buildPython"
        Write-Host ''
        Write-Host "  Either install Python $buildPython on this server so 'py -$buildPython' finds it,"
        Write-Host "  point -PythonExe at the right python.exe, or set python-version to"
        Write-Host "  '$serverPython' in the CI and release workflows and cut a new release."
        Write-Host ''
        throw "Python version mismatch. Nothing was changed on this server."
    }
    Write-Log "Python version matches ($serverPython)"
} else {
    Write-Warning "Package has no BUILD_INFO.txt (built before version stamping). Using Python $serverPython."
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

# --- virtualenvs ------------------------------------------------------------
# They live beside the app folder, so a deploy reuses them untouched unless
# requirements.txt changed. Installs come from the bundled wheels and never
# reach the network.
$syncScript = Join-Path $AppPath 'venv_sync.ps1'
if (-not (Test-Path $syncScript)) {
    throw "venv_sync.ps1 not found in the package at $syncScript."
}
& $syncScript -AppPath $AppPath -PythonExe $pythonExe
if ($LASTEXITCODE -ne 0 -and $LASTEXITCODE -ne $null) {
    throw "Preparing the virtualenvs failed (exit $LASTEXITCODE)"
}

$backendPython = Join-Path ($AppPath + '_venvs') 'backend\Scripts\python.exe'

# --- migrations -------------------------------------------------------------
if ($SkipMigrations) {
    Write-Log 'Skipping migrations as requested'
} else {
    Write-Log 'Running database migrations'
    $backend = Join-Path $AppPath 'backend'
    Push-Location $backend
    try {
        if (-not (Test-Path $backendPython)) { throw "Backend venv not found at $backendPython" }
        $env:PYTHONPATH = ''
        $env:FLASK_APP = 'run.py'
        & $backendPython -m flask db upgrade
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
