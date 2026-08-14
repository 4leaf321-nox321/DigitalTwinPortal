Param()
<#
Simple run script for deployed package.
Usage on server:
  - Unzip deploy_package.zip to a folder (e.g. C:\deploy\DigitalTwin)
  - Open PowerShell, run: .\run_server.ps1

This script sets `PYTHONPATH` to include `site-packages` installed in the package,
then runs the backend entrypoint.
#>

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Push-Location $scriptDir

$sitePackagesPath = Join-Path $scriptDir 'site-packages'
if (Test-Path $sitePackagesPath) {
  Write-Host "Dependency set: $sitePackagesPath"
} else {
  Write-Host 'Warning: site-packages not found in package. Ensure dependencies are installed.'
}

# PYTHONPATH is cleared so an inherited value cannot pull in another copy;
# _launch.py puts the bundled set ahead of the interpreter's own site-packages.
$env:PYTHONPATH = ''
$launcher = Join-Path $scriptDir '_launch.py'

# Pick the interpreter this package was built for. Bare "python" is not safe:
# a server can have a newer Python first on PATH while the app is meant to run
# on an older one, and the bundled wheels only load on the version that built
# them. Ask the py launcher for that exact version, and fall back to PATH.
$pythonExe = 'python'
$buildInfo = Join-Path $scriptDir 'BUILD_INFO.txt'
if (Test-Path $buildInfo) {
  $buildPython = ((Get-Content $buildInfo | Where-Object { $_ -match '^python=' }) -replace '^python=', '').Trim()
  if ($buildPython) {
    try {
      $resolved = & py "-$buildPython" -c "import sys; print(sys.executable)" 2>$null
      if ($LASTEXITCODE -eq 0 -and $resolved) { $pythonExe = $resolved.Trim() }
    } catch {
      # py launcher absent or has no such version; fall through to PATH
    }
    if ($pythonExe -eq 'python') {
      Write-Warning "Could not locate Python $buildPython via the py launcher; falling back to PATH."
    }
  }
}
$actual = & $pythonExe -c "import sys; print('{}.{}'.format(sys.version_info[0], sys.version_info[1]))" 2>$null
Write-Host "Using $pythonExe (Python $actual)"
if ($buildPython -and $actual -and $actual -ne $buildPython) {
  Write-Warning "This package was built for Python $buildPython but $actual is being used. Imports from site-packages will likely fail."
}

# Adjust this to your actual backend entrypoint (run.py or module)
$entrypoint = Join-Path $scriptDir 'backend\run.py'
if (Test-Path $entrypoint) {
  Write-Host 'Starting backend via backend\run.py'
  if (Test-Path $launcher) {
    & $pythonExe $launcher $sitePackagesPath $entrypoint
  } else {
    Write-Warning '_launch.py not found; falling back to PYTHONPATH.'
    $env:PYTHONPATH = $sitePackagesPath
    & $pythonExe $entrypoint
  }
} else {
  Write-Host 'No recognized backend entrypoint found. Please edit run_server.ps1 to start your server.'
}

Pop-Location
