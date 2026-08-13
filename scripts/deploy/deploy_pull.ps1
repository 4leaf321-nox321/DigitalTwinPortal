<#
Simple deployment helper for pulling the latest `origin/main` on a Windows server.

Usage:
  - Run on the server where the repo is cloned: .\deploy_pull.ps1 -RepoPath 'C:\path\to\repo' -ServiceName 'MyAppService'

This script assumes the repository remote `origin` points to the GitHub repo and that the server
has network access and appropriate credentials to fetch from GitHub.
#>

param(
    [string]$RepoPath = "C:\inetpub\wwwroot\DigitalTwinPortal",
    [string]$ServiceName = "",
    [switch]$InstallRequirements
)

if (-not (Test-Path $RepoPath)) {
    Write-Error "Repo path $RepoPath not found."; exit 1
}

Set-Location $RepoPath

Write-Output "Fetching origin and resetting to origin/main..."
git fetch --all
git reset --hard origin/main

if ($InstallRequirements) {
    if (Test-Path "$RepoPath\requirements.txt") {
        Write-Output "Installing Python requirements..."
        & python -m pip install -r "$RepoPath\requirements.txt"
    }
    if (Test-Path "$RepoPath\package.json") {
        Write-Output "Installing Node packages and building frontend..."
        & npm install
        & npm run build
    }
}

if ($ServiceName) {
    Write-Output "Restarting service: $ServiceName"
    try {
        Restart-Service -Name $ServiceName -Force -ErrorAction Stop
    } catch {
        Write-Warning "Failed to restart service $ServiceName: $_"
    }
}

Write-Output "Deploy pull complete."
