@echo off
rem Pig Manager - build and start the local dashboard (http://localhost:3000)
cd /d "%~dp0"
title Pig Manager server - close this window to stop
echo.
echo [1/2] Building... (about 1 minute)
call npm run build
if errorlevel 1 (
  echo.
  echo Build failed. Please send a screenshot of this window to Claude.
  pause
  exit /b 1
)
echo.
echo [2/2] Starting server. The browser will open in a few seconds.
echo Keep this window open while using the dashboard. Close it to stop the server.
start "" cmd /c "timeout /t 6 /nobreak >NUL & start http://localhost:3000"
call npm start
pause
