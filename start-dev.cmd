@echo off
rem Pig Manager - development server with auto refresh (http://localhost:3000)
rem Changed files are picked up automatically. Just refresh the browser (F5).
cd /d "%~dp0"
title Pig Manager DEV server - close this window to stop
echo.
echo Pig Manager development server
echo  - File changes are applied automatically. Refresh the browser (F5) to see them.
echo  - Close start-dashboard.cmd window first if it is running (same port 3000).
echo  - Keep this window open while working. Close it to stop the server.
echo.
start "" cmd /c "timeout /t 8 /nobreak >NUL & start http://localhost:3000"
call npm run dev
echo.
echo The server stopped. If you see an error above, please send a screenshot to Claude.
pause
