Param()
Set-StrictMode -Version Latest

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
Push-Location $root\\..\\..

Write-Host 'Packaging deploy artifact (Windows)'

Remove-Item -Recurse -Force -ErrorAction SilentlyContinue .\\deploy
New-Item -ItemType Directory -Path .\\deploy | Out-Null

$sitePackages = Join-Path .\\deploy site-packages
New-Item -ItemType Directory -Path $sitePackages | Out-Null

if (Test-Path .\\backend\\requirements.txt) {
  Write-Host 'Installing backend dependencies into deploy/site-packages'
  python -m pip install --upgrade pip
  # No --no-deps: requirements.txt lists only top-level packages, so skipping
  # transitive dependencies left site-packages without Werkzeug, itsdangerous,
  # blinker, alembic, bcrypt and PyJWT, and the app could not import Flask.
  python -m pip install -r .\\backend\\requirements.txt -t $sitePackages
  if ($LASTEXITCODE -ne 0) { Write-Error "pip install failed (exit $LASTEXITCODE)"; exit 1 }

  # Fail the build rather than shipping a package that cannot start.
  foreach ($mod in @('werkzeug', 'itsdangerous', 'blinker', 'alembic', 'jwt')) {
    if (-not (Get-ChildItem -Path $sitePackages -Filter $mod -Force -ErrorAction SilentlyContinue)) {
      Write-Error "site-packages is missing '$mod' - the deploy package would not run."
      exit 1
    }
  }
  Write-Host 'Dependency check passed'
} else {
  Write-Host 'No backend requirements.txt found; skipping dependency packaging.'
}

Write-Host 'Copying backend code'
Copy-Item -Recurse -Force .\\backend .\\deploy\\backend

Write-Host 'Copying mcp_server if exists'
if (Test-Path .\\mcp_server) { Copy-Item -Recurse -Force .\\mcp_server .\\deploy\\mcp_server }

Write-Host 'Adding run_server.ps1 template'
Copy-Item -Force .\\scripts\\ci\\run_server_template.ps1 .\\deploy\\run_server.ps1

Write-Host 'Creating zip'
Add-Type -AssemblyName System.IO.Compression.FileSystem
$deployDir = (Resolve-Path .\\deploy).Path
$zipPath = Join-Path $deployDir 'deploy_package.zip'
# Build the archive outside the directory being compressed, then move it in.
# Writing it directly to $deployDir makes CreateFromDirectory try to add the
# archive to itself, which fails with a sharing violation.
$stagingZip = Join-Path ([System.IO.Path]::GetDirectoryName($deployDir)) 'deploy_package.zip'
Remove-Item -Force -ErrorAction SilentlyContinue $stagingZip
[System.IO.Compression.ZipFile]::CreateFromDirectory($deployDir, $stagingZip)
Move-Item -Force $stagingZip $zipPath

if (Test-Path $zipPath) {
  Write-Host "Packaging complete: $zipPath"
} else {
  Write-Error "Failed to create package $zipPath"
  exit 1
}
Pop-Location
