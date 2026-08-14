Param()
<#
Run script for the MCP server in the deployed package.

Usage on server:
  - From the package root: .\run_mcp_server.ps1

The MCP server runs from its own virtualenv at <package>_venvs\mcp_server,
separate from the backend's. mcp pulls in starlette, pydantic, uvicorn and
anyio, which the backend has no reason to carry -- see mcp_server/README.md,
"왜 별도 폴더·별도 venv 인가".

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

$venvPython = Join-Path ($scriptDir + '_venvs') 'mcp_server\Scripts\python.exe'
if (-not (Test-Path $venvPython)) {
  Write-Error "MCP venv not found at $venvPython. Run venv_sync.ps1 -AppPath '$scriptDir' first."
  exit 1
}

$actual = & $venvPython -c "import sys; print('{}.{}'.format(sys.version_info[0], sys.version_info[1]))" 2>$null
Write-Host "Using $venvPython (Python $actual)"

if (-not $env:DT_API_BASE) { $env:DT_API_BASE = 'http://localhost:5174' }
Write-Host "DT_API_BASE = $env:DT_API_BASE"

Push-Location $mcpDir
try {
  & $venvPython server.py
} finally {
  Pop-Location
}
