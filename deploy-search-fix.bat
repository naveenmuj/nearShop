@echo off
echo ============================================
echo  Deploying search fixes to VM
echo ============================================
echo.

set VM=165.232.182.130
set VM_USER=root
set VM_APP=/opt/nearshop

echo [1/3] Copying products/router.py ...
scp nearshop-api\app\products\router.py %VM_USER%@%VM%:%VM_APP%/app/products/router.py
if ERRORLEVEL 1 (
    echo FAILED: Could not copy router.py
    echo Make sure you have SSH key access to the VM.
    echo Alternative: open your VM SSH terminal and manually paste the files.
    pause
    exit /b 1
)

echo [2/3] Copying products/service.py ...
scp nearshop-api\app\products\service.py %VM_USER%@%VM%:%VM_APP%/app/products/service.py
if ERRORLEVEL 1 (
    echo FAILED: Could not copy service.py
    pause
    exit /b 1
)

echo [3/3] Restarting nearshop-api service ...
ssh %VM_USER%@%VM% "systemctl restart nearshop-api && sleep 2 && systemctl is-active nearshop-api"
if ERRORLEVEL 1 (
    echo FAILED: Could not restart service
    pause
    exit /b 1
)

echo.
echo ============================================
echo  Deploy complete! Running quick test...
echo ============================================
echo.

python test_search_api.py http://%VM%

pause
