@echo off
setlocal
REM Launch from this script's location, regardless of the extracted project path.
cd /d "%~dp0..\backend"

if not exist "app\main.py" (
  echo ERROR: Cannot find backend\app\main.py.
  echo Expected this script at: project\scripts\dev-backend.bat
  pause
  exit /b 1
)

where py >nul 2>&1
if errorlevel 1 (
  where python >nul 2>&1
  if errorlevel 1 (
    echo ERROR: Python was not found. Install Python 3.11+ and add it to PATH.
    pause
    exit /b 1
  )
  set "PY_CMD=python"
) else (
  set "PY_CMD=py -3.11"
)

if not exist ".venv\Scripts\python.exe" (
  echo Creating backend virtual environment...
  %PY_CMD% -m venv .venv
  if errorlevel 1 goto :error
)

echo Installing backend dependencies...
".venv\Scripts\python.exe" -m pip install -r requirements.txt
if errorlevel 1 goto :error

echo.
echo Starting Firewall Guard API at http://127.0.0.1:8765
".venv\Scripts\python.exe" -m uvicorn app.main:app --host 127.0.0.1 --port 8765
if errorlevel 1 goto :error
goto :eof

:error
echo.
echo ERROR: Backend setup or startup failed.
pause
endlocal
