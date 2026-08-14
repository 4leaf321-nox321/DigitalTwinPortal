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
  MCP_HOST      bind address           (default 0.0.0.0 here, see below)
  MCP_PORT      bind port              (default 3003)

server.py itself defaults MCP_HOST to 127.0.0.1, which only accepts
connections from the machine it runs on. That suits development, where the AI
client runs on the same PC. In production users connect from their own
machines, so this script binds 0.0.0.0 instead -- see mcp_server/README.md,
"운영에서는 MCP_HOST=0.0.0.0 이 필요하다". Set MCP_HOST yourself to override.

Exposure is by design: each caller sends their own JWT and this server just
forwards the Authorization header to the backend, which applies the same
per-project permissions as the web UI. There is no service account here.

The port also has to be open inbound:
  netsh advfirewall firewall add rule name="DT MCP 3003" dir=in action=allow protocol=TCP localport=3003
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
if (-not $env:MCP_HOST)    { $env:MCP_HOST = '0.0.0.0' }
if (-not $env:MCP_PORT)    { $env:MCP_PORT = '3003' }

Write-Host "DT_API_BASE = $env:DT_API_BASE"
Write-Host "Binding     = $($env:MCP_HOST):$($env:MCP_PORT)"

if ($env:MCP_HOST -eq '0.0.0.0') {
  # Report an address other machines can actually use; the bind address itself
  # is not one. Verifying from this machine proves nothing either -- localhost
  # answers whatever MCP_HOST is set to.
  $ip = (Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue |
    Where-Object { $_.IPAddress -notlike '127.*' -and $_.IPAddress -notlike '169.254.*' } |
    Select-Object -First 1).IPAddress
  if ($ip) { Write-Host "Clients connect to http://${ip}:$($env:MCP_PORT)/mcp (verify from another machine)" }
  Write-Host "Inbound TCP $($env:MCP_PORT) must be open in the firewall."
} else {
  Write-Warning "MCP_HOST is $env:MCP_HOST - only this machine can connect. Production needs 0.0.0.0."
}

Push-Location $mcpDir
try {
  & $venvPython server.py
} finally {
  Pop-Location
}
