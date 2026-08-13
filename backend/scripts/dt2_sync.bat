@echo off
setlocal
REM ===========================================================================
REM  Digital Twin Dashboard - V1 to V2 periodic sync (for Task Scheduler)
REM
REM  Runs dt2_import.py --commit:
REM    - refreshes dt2_* tables from dashboard_data (read-only on the source)
REM    - appends one history row per performance/project ONLY when values changed
REM
REM  ASCII ONLY. cmd.exe reads .bat files in the OEM codepage, so non-ASCII
REM  comments get parsed as commands. Korean notes live in the runbook instead.
REM
REM  DB connection comes from backend\.env (DATABASE_URL). No secrets here.
REM  Logs: backend\scripts\out\dt2_import_*.log
REM ===========================================================================

cd /d "%~dp0.."
if errorlevel 1 (
    echo [FAIL] cannot cd to backend folder
    exit /b 1
)

if not exist "venv\Scripts\activate.bat" (
    echo [FAIL] venv not found: %CD%\venv
    exit /b 1
)

if not exist ".env" (
    echo [FAIL] .env not found: %CD%\.env
    exit /b 1
)

call "venv\Scripts\activate.bat"
if errorlevel 1 (
    echo [FAIL] venv activation failed
    exit /b 1
)

python scripts\dt2_import.py --commit
set RC=%ERRORLEVEL%

if not "%RC%"=="0" (
    echo [FAIL] sync failed with exit code %RC% - check scripts\out\ for the latest log
) else (
    echo [OK] sync done
)
exit /b %RC%
