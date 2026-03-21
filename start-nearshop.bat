@echo off
title NearShop Dev Servers
color 0A

echo ================================================
echo   NearShop - Starting Development Servers
echo ================================================
echo.

:: Kill any existing processes on ports 8000 and 5173
echo [1/4] Cleaning up existing processes...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":8000 " 2^>nul') do taskkill /f /pid %%a >nul 2>&1
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":5173 " 2^>nul') do taskkill /f /pid %%a >nul 2>&1
timeout /t 1 /nobreak >nul

:: Start Backend (FastAPI)
echo [2/4] Starting Backend API (http://localhost:8000) ...
start "NearShop API" cmd /k "cd /d %~dp0nearshop-api && echo Backend starting... && python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload"

:: Wait for backend to be ready
echo [3/4] Waiting for backend to initialize...
timeout /t 4 /nobreak >nul

:: Start Frontend (Vite + React)
echo [4/4] Starting Frontend (http://localhost:5173) ...
start "NearShop Web" cmd /k "cd /d %~dp0nearshop-web && echo Frontend starting... && npm run dev"

echo.
echo ================================================
echo   Servers launching in separate windows:
echo   Backend API  : http://localhost:8000
echo   API Docs     : http://localhost:8000/docs
echo   Frontend App : http://localhost:5173
echo ================================================
echo.
echo Press any key to open the app in your browser...
pause >nul

start "" "http://localhost:5173"
