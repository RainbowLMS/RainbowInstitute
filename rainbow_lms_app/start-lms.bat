@echo off
setlocal
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js 22 or newer is required.
  echo Download and install the current Node.js LTS release, then run this file again.
  pause
  exit /b 1
)
echo Starting Rainbow Restoration LMS at http://127.0.0.1:8787
start "" powershell -NoProfile -WindowStyle Hidden -Command "Start-Sleep -Seconds 2; Start-Process 'http://127.0.0.1:8787'"
node --no-warnings server.js
pause
