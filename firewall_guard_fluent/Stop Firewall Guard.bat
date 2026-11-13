@echo off
setlocal EnableExtensions
title Stop Firewall Guard
echo Stopping Firewall Guard (ports 8765 / 5173)...

set "killed="
for /f "tokens=5" %%P in ('netstat -aon ^| findstr /r /c:":8765 .*LISTENING"') do (
    taskkill /PID %%P /T /F >nul 2>&1
    set "killed=1"
)
for /f "tokens=5" %%P in ('netstat -aon ^| findstr /r /c:":5173 .*LISTENING"') do (
    taskkill /PID %%P /T /F >nul 2>&1
    set "killed=1"
)

if defined killed (
    echo Done - Firewall Guard is stopped.
) else (
    echo Nothing was running - ports 8765/5173 were already free.
)
pause
endlocal
