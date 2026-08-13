Param()
Write-Host 'Starting Windows build script for Digital Twin Portal'

# Backend venv and deps
Write-Host 'Creating backend virtual environment and installing dependencies'
python -m venv .\backend\.venv
. .\backend\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
if (Test-Path .\backend\requirements.txt) { pip install -r .\backend\requirements.txt }

# Optional: run backend tests if present
if (Test-Path .\backend\tests) {
  Write-Host 'Running backend tests'
  pip install pytest || Write-Host 'pytest install failed'
  pytest backend\tests -q
} else {
  Write-Host 'No backend tests found; skipping.'
}

# Frontend build
if (Test-Path .\frontend\package.json) {
  Write-Host 'Building frontend'
  Push-Location frontend
  npm ci
  npm run build
  Pop-Location
} else {
  Write-Host 'No frontend project found; skipping.'
}

Write-Host 'Windows build script finished.'
