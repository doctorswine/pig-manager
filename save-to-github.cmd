@echo off
chcp 65001 >NUL
rem Pig Manager - save changes to GitHub (git add + commit + push) with one double-click.
rem Commit message: .commit-message.txt (written by Claude after each task). If missing, a default message is used.
cd /d "%~dp0"
title Pig Manager - save to GitHub
echo.
echo [1/3] Changed files
echo ------------------------------------------------------------
set CHANGED=
for /f "delims=" %%i in ('git status --porcelain') do set CHANGED=1
if not defined CHANGED (
  echo No changes to save. Everything is already on GitHub.
  echo.
  pause
  exit /b 0
)
git status --short
echo ------------------------------------------------------------
echo.
if exist ".commit-message.txt" (
  echo Commit message:
  type ".commit-message.txt"
) else (
  echo Commit message: chore: save work
)
echo.
echo Press any key to save these files to GitHub. Close this window to cancel.
pause >NUL
echo.
echo [2/3] Commit
git add -A
if exist ".commit-message.txt" (
  git commit -F ".commit-message.txt"
) else (
  git commit -m "chore: save work"
)
if errorlevel 1 (
  echo.
  echo Commit failed. Please send a screenshot of this window to Claude.
  pause
  exit /b 1
)
echo.
echo [3/3] Push to GitHub
git push
if errorlevel 1 (
  echo.
  echo Push failed. The commit is saved on this PC. Please send a screenshot of this window to Claude.
  pause
  exit /b 1
)
if exist ".commit-message.txt" move /y ".commit-message.txt" ".commit-message.last.txt" >NUL
echo.
echo Done. Saved to GitHub.
git log -1 --oneline
echo.
pause
