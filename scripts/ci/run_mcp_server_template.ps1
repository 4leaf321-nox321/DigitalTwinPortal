Param()
<#
Run script for the MCP server in the deployed package.

Usage on server:
  - From the package root: .\run_mcp_server.ps1

The MCP server keeps its own dependency set under `mcp_server\site-packages`,
separate from the backend's. mcp pulls in starlette, pydantic, uvicorn and
anyio, which the backend has no reason to carry -- see mcp_server/README.md,
"왜 별도 폴더·별도 venv 인가". No venv is created; the package ships both sets.

Environment variables (optional):
  DT_API_BASE   backend API base URL   (default http://localhost:5174)
  MCP_HOST      bind address           (default 127.0.0.1)
  MCP_PORT      bind port              (default 3003)
#>

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$mcpDir = Join-Path $scriptDir 'mcp_server'

if (-not (Test-Path (Join-Path $mcpDir 'server.py'))) {
  Write-Error "mcp_server\server.py not found. Is this the package root?"
  exit 1
}

# Use the interpreter this package was built for, not whatever PATH resolves
# to; the bundled wheels only load on the version that built them.
$pythonExe = 'python'
$buildPython = $null
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
  Write-Warning "This package was built for Python $buildPython but $actual is being used. Imports will likely fail."
}

# Only the MCP dependency set is used here. The backend's site-packages is
# deliberately left out so the two cannot shadow each other.
#
# _launch.py rather than PYTHONPATH: pywin32 ships a .pth file that PYTHONPATH
# would ignore, and without it `import mcp` fails on Windows. See _launch.py.
$launcher = Join-Path $scriptDir '_launch.py'
if (-not (Test-Path $launcher)) { Write-Error "_launch.py not found next to this script."; exit 1 }
$mcpSitePackages = Join-Path $mcpDir 'site-packages'
Write-Host "Dependency set: $mcpSitePackages"

if (-not $env:DT_API_BASE) { $env:DT_API_BASE = 'http://localhost:5174' }
Write-Host "DT_API_BASE = $env:DT_API_BASE"

# PYTHONPATH is cleared so an inherited value cannot pull in another copy.
$env:PYTHONPATH = ''

Push-Location $mcpDir
try {
  & $pythonExe $launcher $mcpSitePackages (Join-Path $mcpDir 'server.py')
} finally {
  Pop-Location
}
