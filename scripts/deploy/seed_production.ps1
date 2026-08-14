<#
Production seed template.

This script should be idempotent: running it multiple times should not duplicate data.
Customize to insert only missing baseline data.

Example usage: called by `deploy_pull.ps1 -RunSeed` after migrations succeed.
#>

Write-Output "Running production seed (template). Edit this file with project-specific seeding logic."

# Example: run a Flask CLI seeding command if available
if (Test-Path "backend\.venv\Scripts\Activate.ps1") {
    & "backend\.venv\Scripts\Activate.ps1"
}

if (Get-Command python -ErrorAction SilentlyContinue) {
    if (Test-Path "backend\manage.py") {
        Write-Output "Invoking backend/manage.py seed (if implemented)"
        python backend\manage.py seed || Write-Warning "manage.py seed failed or not implemented"
    } else {
        Write-Output "No manage.py found; add custom seed commands here."
    }
} else {
    Write-Warning "Python not available for seeding."
}

Write-Output "Seed script complete."
