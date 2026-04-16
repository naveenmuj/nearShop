@echo off
echo ============================================
echo   OpenAI API Test for NearShop
echo ============================================
echo.

REM Activate virtual environment if it exists
if exist .venv\Scripts\activate.bat (
    echo [INFO] Activating Python virtual environment...
    call .venv\Scripts\activate.bat
)

echo [INFO] Installing/Upgrading openai library...
pip install --quiet --upgrade openai

echo.
echo ============================================
echo   Running OpenAI API Test
echo ============================================
echo.

python test_openai_api.py

echo.
echo ============================================
pause
