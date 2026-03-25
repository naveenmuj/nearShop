@echo off
REM NearShop - Start Backend API
REM This script starts the FastAPI backend server

title NearShop Backend API
cd /d "%~dp0nearshop-api"

echo.
echo ========================================
echo  NearShop Backend API
echo ========================================
echo.
echo Starting FastAPI server on http://localhost:8000
echo API Documentation: http://localhost:8000/docs
echo.

python -m uvicorn app.main:app --reload --port 8000

if errorlevel 1 (
    echo.
    echo ERROR: Failed to start backend
    echo Make sure Python 3.11+ is installed
    echo.
    pause
    exit /b 1
)

pause
