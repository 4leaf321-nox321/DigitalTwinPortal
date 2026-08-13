<#
Register repository secrets using the GitHub CLI (`gh`).

Usage:
  - Interactive (prompts): .\set_secrets.ps1
  - Pass values as parameters: .\set_secrets.ps1 -PublishPat 'ghp_xxx' -McpPat 'ghp_yyy'

This script requires `gh` to be authenticated with rights to modify repository secrets.
It sets `PUBLISH_PAT` and `MCP_PAT` for the current repository.
#>

param(
    [string]$PublishPat,
    [string]$McpPat
)

function Read-Secret([string]$name) {
    $secure = Read-Host -AsSecureString "$name (paste then Enter)";
    return [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure));
}

if (-not (Get-Command gh -ErrorAction SilentlyContinue)) {
    Write-Error "gh CLI not found. Install from https://github.com/cli/cli and authenticate before running this script."
    exit 1
}

if (-not $PublishPat) { $PublishPat = Read-Secret 'PUBLISH_PAT' }
if (-not $McpPat) { $McpPat = Read-Secret 'MCP_PAT' }

Write-Output "Setting repository secrets (requires gh auth)."

gh secret set PUBLISH_PAT --body "$PublishPat"
if ($LASTEXITCODE -ne 0) { Write-Error "Failed to set PUBLISH_PAT"; exit 2 }

gh secret set MCP_PAT --body "$McpPat"
if ($LASTEXITCODE -ne 0) { Write-Error "Failed to set MCP_PAT"; exit 3 }

Write-Output "Secrets set successfully."
