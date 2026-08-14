<#
Bring the virtualenvs in line with the deployed code.

The venvs live beside the app folder rather than inside it:

    <AppPath>            code, swapped on every deploy
    <AppPath>_venvs\backend
    <AppPath>_venvs\mcp_server

Keeping them outside means a deploy never has to rebuild or copy them, and
their absolute paths stay valid. Each one is rebuilt only when its
requirements.txt changes; a hash of that file is stored next to the venv and
compared on every run.

Installs come from the wheel bundle shipped in the package
(`pip install --no-index --find-links=packages`), so nothing here needs the
network. That matters on a corporate network where pip is not dependable.

Backend and MCP keep separate environments on purpose -- see
mcp_server/README.md, "왜 별도 폴더·별도 venv 인가".

Usage:
  .\venv_sync.ps1 -AppPath 'C:\apps\DigitalTwinPortal' -PythonExe 'C:\...\python.exe'
#>

param(
    [Parameter(Mandatory = $true)][string]$AppPath,
    [string]$PythonExe = 'python',
    [switch]$Force
)

$ErrorActionPreference = 'Stop'
function Write-Log([string]$m) { Write-Host "[$(Get-Date -Format 'HH:mm:ss')] $m" }

$venvRoot = $AppPath + '_venvs'
$components = @('backend', 'mcp_server')
$synced = @()

foreach ($component in $components) {
    $componentDir = Join-Path $AppPath $component
    $req = Join-Path $componentDir 'requirements.txt'
    if (-not (Test-Path $req)) {
        Write-Log "$component has no requirements.txt; skipping."
        continue
    }

    $venvDir = Join-Path $venvRoot $component
    $venvPython = Join-Path $venvDir 'Scripts\python.exe'
    $stampFile = Join-Path $venvRoot "$component.requirements.sha256"
    $wanted = (Get-FileHash -Algorithm SHA256 $req).Hash

    $current = $null
    if (Test-Path $stampFile) { $current = (Get-Content $stampFile -Raw).Trim() }

    if ((-not $Force) -and (Test-Path $venvPython) -and $current -eq $wanted) {
        Write-Log "$component venv is current; reusing it."
        $synced += $component
        continue
    }

    if (-not (Test-Path $venvPython)) {
        Write-Log "Creating $component venv at $venvDir"
        New-Item -ItemType Directory -Force -Path $venvRoot | Out-Null
        & $PythonExe -m venv $venvDir
        if ($LASTEXITCODE -ne 0) { throw "Could not create the $component venv (exit $LASTEXITCODE)" }
    } else {
        Write-Log "$component requirements changed; reinstalling."
    }

    $wheelDir = Join-Path $componentDir 'packages'
    if (-not (Test-Path $wheelDir)) {
        throw "$component wheel bundle not found at $wheelDir. The package is incomplete."
    }

    Write-Log "Installing $component dependencies from the bundled wheels"
    # Quote the whole option: an unquoted "--find-links=<expr>" can be split
    # into two arguments, and pip then treats the directory as a package.
    & $venvPython -m pip install --no-index "--find-links=$wheelDir" -r $req
    if ($LASTEXITCODE -ne 0) {
        # Leave the stamp untouched so the next run retries instead of assuming
        # this venv is good.
        throw "Installing $component dependencies failed (exit $LASTEXITCODE)"
    }

    Set-Content -Encoding ascii -Path $stampFile -Value $wanted
    Write-Log "$component venv ready"
    $synced += $component
}

Write-Log ("Synced: " + ($synced -join ', '))
