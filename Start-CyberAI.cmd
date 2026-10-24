@echo off
setlocal
cd /d "%~dp0"
where node >nul 2>&1
if errorlevel 1 (
  echo Install Node.js 22 or newer, then run this launcher again.
  pause
  exit /b 1
)
if not exist "node_modules\next\package.json" (
  call npm ci
  if errorlevel 1 (
    echo Dependency installation failed. Check your internet connection and npm output.
    pause
    exit /b 1
  )
)
echo Open http://127.0.0.1:3100 after the server reports Ready.
call npm run dev
pause
