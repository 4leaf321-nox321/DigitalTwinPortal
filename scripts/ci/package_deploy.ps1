Param()
Set-StrictMode -Version Latest

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
Push-Location $root\\..\\..

Write-Host 'Packaging deploy artifact (Windows)'

Remove-Item -Recurse -Force -ErrorAction SilentlyContinue .\\deploy
New-Item -ItemType Directory -Path .\\deploy | Out-Null

Write-Host 'Copying backend code'
Copy-Item -Recurse -Force .\\backend .\\deploy\\backend

Write-Host 'Copying mcp_server if exists'
if (Test-Path .\\mcp_server) { Copy-Item -Recurse -Force .\\mcp_server .\\deploy\\mcp_server }

# Build a wheel bundle per component rather than installing into the package.
#
# The server creates real virtualenvs from these with
# `pip install --no-index --find-links=packages`, so deploys never touch the
# network -- pip against the corporate network is not dependable enough to sit
# in the middle of a deploy. This is the layout backend/setup_venv.ps1 and
# mcp_server/setup_venv.ps1 already expect; they just had no packages/ to
# work with.
#
# Each component keeps its own bundle: mcp drags in starlette, pydantic,
# uvicorn and anyio that the backend has no reason to carry. See
# mcp_server/README.md, "왜 별도 폴더·별도 venv 인가".
python -m pip install --upgrade pip

$bundles = @(
  @{ Name = 'backend';    Dir = '.\\deploy\\backend';    Expect = @('werkzeug', 'itsdangerous', 'blinker', 'alembic', 'pyjwt', 'flask') },
  @{ Name = 'mcp_server'; Dir = '.\\deploy\\mcp_server'; Expect = @('mcp', 'httpx', 'anyio', 'pydantic', 'starlette', 'pywin32') }
)

foreach ($bundle in $bundles) {
  $req = Join-Path $bundle.Dir 'requirements.txt'
  if (-not (Test-Path $req)) {
    Write-Host "No $($bundle.Name)/requirements.txt; skipping its wheel bundle."
    continue
  }

  $wheelDir = Join-Path $bundle.Dir 'packages'
  Write-Host "Building wheel bundle for $($bundle.Name)"
  python -m pip wheel -r $req -w $wheelDir
  if ($LASTEXITCODE -ne 0) { Write-Error "pip wheel failed for $($bundle.Name) (exit $LASTEXITCODE)"; exit 1 }

  # Fail the build rather than shipping a bundle that cannot produce a venv.
  $wheels = Get-ChildItem -Path $wheelDir -Filter '*.whl' -ErrorAction SilentlyContinue
  foreach ($mod in $bundle.Expect) {
    if (-not ($wheels | Where-Object { $_.Name -replace '_', '-' -like "$($mod -replace '_', '-')-*" })) {
      Write-Error "$($bundle.Name)/packages is missing a wheel for '$mod'."
      exit 1
    }
  }
  Write-Host "  $($wheels.Count) wheels, dependency check passed"
}

Write-Host 'Adding run scripts'
Copy-Item -Force .\\scripts\\ci\\run_server_template.ps1 .\\deploy\\run_server.ps1
Copy-Item -Force .\\scripts\\deploy\\venv_sync.ps1 .\\deploy\\venv_sync.ps1
if (Test-Path .\\deploy\\mcp_server) {
  Copy-Item -Force .\\scripts\\ci\\run_mcp_server_template.ps1 .\\deploy\\run_mcp_server.ps1
}

# Record the Python that built the wheels. Binary wheels carry ABI tags (for
# example psycopg_binary-...-cp313-win_amd64.whl) and will not install on a
# different minor version, so deploy.ps1 compares this against the server's.
$buildPython = & python -c "import sys; print('{}.{}'.format(sys.version_info[0], sys.version_info[1]))"
if ($LASTEXITCODE -ne 0) { Write-Error 'Could not determine build Python version'; exit 1 }
Write-Host "Recording build Python version: $buildPython"
Set-Content -Encoding utf8 -Path .\\deploy\\BUILD_INFO.txt -Value "python=$buildPython"

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
