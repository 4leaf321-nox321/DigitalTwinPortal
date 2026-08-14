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
  # No ternary here: Windows PowerShell 5.1 is the default shell on the server
  # and would fail to parse "? :", taking the whole script with it.
  if ($env:PYTHONPATH) {
    $env:PYTHONPATH = $sitePackagesPath + [System.IO.Path]::PathSeparator + $env:PYTHONPATH
  } else {
    $env:PYTHONPATH = $sitePackagesPath
  }
  Write-Host "PYTHONPATH set to $env:PYTHONPATH"
} else {
  Write-Host 'Warning: site-packages not found in package. Ensure dependencies are installed.'
}

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
if (Test-Path .\\backend\\run.py) {
  Write-Host 'Starting backend via backend\\run.py'
  & $pythonExe .\\backend\\run.py
} elseif (Test-Path .\\backend\\run\\__main__.py) {
  Write-Host 'Starting backend via python -m backend.run'
  & $pythonExe -m backend.run
} else {
  Write-Host 'No recognized backend entrypoint found. Please edit run_server.ps1 to start your server.'
}

Pop-Location
