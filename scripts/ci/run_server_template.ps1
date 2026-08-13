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

# Adjust this to your actual backend entrypoint (run.py or module)
if (Test-Path .\\backend\\run.py) {
  Write-Host 'Starting backend via backend\\run.py'
  python .\\backend\\run.py
} elseif (Test-Path .\\backend\\run\\__main__.py) {
  Write-Host 'Starting backend via python -m backend.run'
  python -m backend.run
} else {
  Write-Host 'No recognized backend entrypoint found. Please edit run_server.ps1 to start your server.'
}

Pop-Location
