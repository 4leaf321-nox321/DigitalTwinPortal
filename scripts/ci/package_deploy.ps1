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
  python -m pip install --no-deps -r .\\backend\\requirements.txt -t $sitePackages
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
[System.IO.Compression.ZipFile]::CreateFromDirectory((Resolve-Path .\\deploy).Path, (Resolve-Path .\\deploy\\deploy_package.zip).Path)

Write-Host 'Packaging complete: deploy\\deploy_package.zip'
Pop-Location
