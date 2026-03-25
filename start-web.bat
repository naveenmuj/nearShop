@echo off
REM NearShop - Start Web App
REM This script starts the React web app on localhost:5173

title NearShop Web App
cd /d "%~dp0nearshop-web"

echo.
echo ========================================
echo  NearShop Web App
echo ========================================
echo.
echo Starting development server on http://localhost:5173
echo.

if not exist "node_modules" (
    echo Installing dependencies...
    call npm install
)

call npm run dev

if errorlevel 1 (
    echo.
    echo ERROR: Failed to start web app
    echo Make sure Node.js is installed and npm dependencies are installed
    echo.
    pause
    exit /b 1
)

pause
