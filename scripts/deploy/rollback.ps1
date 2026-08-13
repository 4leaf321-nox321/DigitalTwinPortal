<#
Swap the current install back to the previous one kept by deploy.ps1.

Only the files are reverted. Migrations are not undone, so if the failed
deploy applied a destructive migration, restore the database separately.

Stop the running app before rolling back; Windows locks files that are in use.

Usage:
  .\rollback.ps1 -AppPath 'C:\apps\DigitalTwinPortal'
#>

param(
    [Parameter(Mandatory = $true)][string]$AppPath
)

$ErrorActionPreference = 'Stop'
function Write-Log([string]$m) { Write-Host "[$(Get-Date -Format 'HH:mm:ss')] $m" }

$prevPath = $AppPath + '_prev'
$tempPath = $AppPath + '_rollback_tmp'

if (-not (Test-Path $prevPath)) { throw "No previous version at $prevPath" }
if (-not (Test-Path $AppPath))  { throw "No current install at $AppPath" }

$lockProbe = Join-Path $AppPath ('.rollback_lock_probe_' + [guid]::NewGuid().ToString('N'))
try {
    New-Item -ItemType File -Path $lockProbe -Force | Out-Null
    Remove-Item -Force $lockProbe
} catch {
    throw "Cannot write to $AppPath. Close the running app and any shell sitting in that folder, then retry."
}

# Swap through a third name so a failure never leaves both names pointing at
# the same content or the live path missing.
if (Test-Path $tempPath) { Remove-Item -Recurse -Force $tempPath }
Write-Log 'Swapping current and previous'
Move-Item -Force $AppPath $tempPath
Move-Item -Force $prevPath $AppPath
Move-Item -Force $tempPath $prevPath

Write-Log 'Rollback complete'
Write-Host ''
Write-Host "Start the app with:"
Write-Host "  cd '$AppPath'"
Write-Host "  .\run_server.ps1"
Write-Host ''
Write-Host "The rolled-back version is now at $prevPath."
Write-Host "Database migrations were NOT reverted."
