@echo off
setlocal EnableExtensions
cd /d "%~dp0.."
title Firewall Guard
echo.
echo   Firewall Guard - starting...
echo.

REM ---------- 0) refuse to double-start ----------
netstat -aon | findstr /r /c:":8765 .*LISTENING" >nul 2>&1
if not errorlevel 1 (
    echo Firewall Guard already appears to be running ^(port 8765 in use^).
    echo Use "Stop Firewall Guard.bat" first if you intend a fresh start.
    pause
    exit /b 0
)

REM ---------- 1) Python venv + cached dependency install ----------
echo [1/4] Preparing backend dependencies...
where py >nul 2>&1
if not errorlevel 1 (
    if not exist "backend\.venv\Scripts\python.exe" py -3.11 -m venv "backend\.venv"
) else (
    if not exist "backend\.venv\Scripts\python.exe" python -m venv "backend\.venv"
)
if not exist "backend\.venv\Scripts\python.exe" goto :python_fail

set "PY=%cd%\backend\.venv\Scripts\python.exe"
certutil -hashfile "backend\requirements.txt" SHA256 > "%TEMP%\fgf_req_now.txt" 2>nul
if exist "backend\.venv\.requirements-hash" (
    fc "backend\.venv\.requirements-hash" "%TEMP%\fgf_req_now.txt" >nul 2>&1
    if not errorlevel 1 (
        echo        cached - skipping install.
        goto :deps_done
    )
    echo        requirements.txt changed - reinstalling...
) else (
    echo        first run - installing...
)
"%PY%" -m pip install -r "backend\requirements.txt" --quiet --disable-pip-version-check
if errorlevel 1 goto :pip_fail
copy /y "%TEMP%\fgf_req_now.txt" "backend\.venv\.requirements-hash" >nul
findstr /r /c:":" "backend\.venv\.requirements-hash" >nul 2>&1
if errorlevel 1 goto :pip_fail
:deps_done

REM ---------- sleep helper: no stdin dependency ----------
:nop

REM ---------- 2) backend ----------
echo [2/4] Starting backend on http://127.0.0.1:8765 ...
pushd "backend"
start "FGF Backend" /min cmd /c ".venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8765 > ..\fgf-backend.log 2>&1"
popd

set /a tries=0
:wait_api
netstat -aon | findstr /r /c:":8765 .*LISTENING" >nul 2>&1
if not errorlevel 1 goto :api_up
set /a tries+=1
if %tries% geq 60 goto :api_fail
ping -n 2 127.0.0.1 >nul
goto :wait_api
:api_up
echo        backend is listening.

REM ---------- 3) frontend ----------
echo [3/4] Preparing dashboard...
if not exist "frontend\.env" if exist "frontend\.env.example" copy /y "frontend\.env.example" "frontend\.env" >nul
if not exist "frontend\node_modules" (
    echo        installing frontend dependencies - first run only...
    pushd "frontend"
    call npm install --no-fund --no-audit
    if errorlevel 1 (
        popd
        goto :npm_fail
    )
    popd
) else (
    echo        cached - skipping install.
)
if exist "frontend\fgf-vite.log" del "frontend\fgf-vite.log" >nul 2>&1
echo [4/4] Starting dashboard on http://127.0.0.1:5173 ...
pushd "frontend"
start "FGF Dashboard" /min cmd /c "npm run dev > fgf-vite.log 2>&1"
popd

set /a tries=0
:wait_web
netstat -aon | findstr /r /c:":5173 .*LISTENING" >nul 2>&1
if not errorlevel 1 goto :web_up
set /a tries+=1
if %tries% geq 60 goto :web_fail
ping -n 2 127.0.0.1 >nul
goto :wait_web
:web_up
start "" http://127.0.0.1:5173

echo.
echo  ============================================================
echo    Firewall Guard is running
echo      Dashboard : http://127.0.0.1:5173
echo      API       : http://127.0.0.1:8765
echo.
echo    Both run in minimized console windows ("FGF Backend",
echo    "FGF Dashboard"). Close those windows - or run
echo    "Stop Firewall Guard.bat" - to shut everything down.
echo  ============================================================
echo.
pause
exit /b 0

:python_fail
echo.
echo   ERROR: Python venv could not be created.
echo          Install Python 3.11+ and make sure "py" or "python" is in PATH.
goto :fail
:pip_fail
echo   ERROR: dependency install failed. Check backend\requirements.txt and internet access.
goto :fail
:npm_fail
echo   ERROR: frontend dependency install failed. Check Node.js/npm in PATH.
goto :fail
:api_fail
echo.
echo   ERROR: backend did not start within 60 seconds.
echo          Log: backend\..\fgf-backend.log - or run scripts\dev-backend.bat
goto :fail
:web_fail
echo.
echo   ERROR: dashboard did not start within 60 seconds.
echo          Log: frontend\fgf-vite.log
goto :fail
:fail
echo.
pause
exit /b 1
