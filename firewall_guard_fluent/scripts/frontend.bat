
@echo off
setlocal
cd /d "%~dp0..\frontend"

echo ========================================
echo   Firewall Guard - Fluent UI
echo ========================================

where node >nul 2>&1
if errorlevel 1 (
    echo ERROR: Node.js was not found in PATH.
    echo Install Node.js 20 or newer.
    pause
    exit /b 1
)

where npm >nul 2>&1
if errorlevel 1 (
    echo ERROR: npm was not found in PATH.
    pause
    exit /b 1
)

if not exist ".env" (
    if exist ".env.example" (
        copy ".env.example" ".env" >nul
        echo Created frontend .env from .env.example
    )
)

if not exist "node_modules" (
    echo Installing frontend dependencies...
    call npm install
    if errorlevel 1 goto :error
)

echo.
echo Starting Fluent UI frontend...
call npm run dev
goto :end

:error
echo.
echo ERROR: Frontend setup or startup failed.
pause

:end
endlocal
