Param()
<#
Run script for the deployed backend.

Usage on server:
  - From the package root: .\run_server.ps1

Dependencies come from the backend virtualenv that deploy.ps1 (or
venv_sync.ps1) builds beside this folder, at <package>_venvs\backend. A venv
is used rather than PYTHONPATH so the interpreter's own site-packages cannot
leak in, and so .pth files are honoured.
#>

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Push-Location $scriptDir

$venvPython = Join-Path ($scriptDir + '_venvs') 'backend\Scripts\python.exe'
if (-not (Test-Path $venvPython)) {
  Write-Error "Backend venv not found at $venvPython. Run venv_sync.ps1 -AppPath '$scriptDir' first."
  Pop-Location
  exit 1
}

$actual = & $venvPython -c "import sys; print('{}.{}'.format(sys.version_info[0], sys.version_info[1]))" 2>$null
Write-Host "Using $venvPython (Python $actual)"

$buildInfo = Join-Path $scriptDir 'BUILD_INFO.txt'
if (Test-Path $buildInfo) {
  $buildPython = ((Get-Content $buildInfo | Where-Object { $_ -match '^python=' }) -replace '^python=', '').Trim()
  if ($buildPython -and $actual -and $actual -ne $buildPython) {
    Write-Warning "The wheels were built for Python $buildPython but this venv is $actual."
  }
}

# Adjust this to your actual backend entrypoint (run.py or module)
$entrypoint = Join-Path $scriptDir 'backend\run.py'
if (Test-Path $entrypoint) {
  Write-Host 'Starting backend via backend\run.py'
  Push-Location (Join-Path $scriptDir 'backend')
  try {
    & $venvPython run.py
  } finally {
    Pop-Location
  }
} else {
  Write-Host 'No recognized backend entrypoint found. Please edit run_server.ps1 to start your server.'
}

Pop-Location
