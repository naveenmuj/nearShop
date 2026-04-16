@echo off
setlocal EnableDelayedExpansion

echo ============================================
echo   NearShop Mobile Build
echo ============================================
echo.

set "JAVA_HOME=C:\Program Files\Android\Android Studio\jbr"
set "ANDROID_HOME=%LOCALAPPDATA%\Android\Sdk"
set "PATH=%JAVA_HOME%\bin;%ANDROID_HOME%\platform-tools;%PATH%"
set "NODE_OPTIONS=--max_old_space_size=4096"
set "_JAVA_OPTIONS=-Xmx3072m -XX:MaxMetaspaceSize=512m"
set "NODE_ENV=production"

set "ROOT_DIR=%~dp0"
set "MOBILE_DIR=%ROOT_DIR%nearshop-mobile"
set "APK_SOURCE=%MOBILE_DIR%\android\app\build\outputs\apk\release\app-release.apk"

for /f "tokens=2 delims==" %%a in ('wmic os get localdatetime /value 2^>nul') do set "dt=%%a"
set "TIMESTAMP=%dt:~0,4%-%dt:~4,2%-%dt:~6,2%_%dt:~8,2%-%dt:~10,2%-%dt:~12,2%"
set "BUILD_DIR=%ROOT_DIR%build\%TIMESTAMP%"
set "APK_OUT=%BUILD_DIR%\nearshop-%TIMESTAMP%.apk"

echo [INFO] Java  : %JAVA_HOME%
echo [INFO] Output: %BUILD_DIR%
echo.

"%JAVA_HOME%\bin\java.exe" -version >nul 2>&1
if ERRORLEVEL 1 (
    echo [ERROR] Java not found at %JAVA_HOME%
    pause
    exit /b 1
)

cd /d "%MOBILE_DIR%\android"
if ERRORLEVEL 1 (
    echo [ERROR] Not found: %MOBILE_DIR%\android
    pause
    exit /b 1
)

echo [BUILD] Running Gradle assembleRelease...
echo         First run: 5-10 min. Subsequent: about 2 min.
echo.
call gradlew.bat assembleRelease --no-daemon
if ERRORLEVEL 1 (
    echo.
    echo [FAILED] Gradle build failed. See output above.
    pause
    exit /b 1
)

if not exist "%APK_SOURCE%" (
    echo [ERROR] APK not found at expected path:
    echo         %APK_SOURCE%
    pause
    exit /b 1
)

if not exist "%BUILD_DIR%" mkdir "%BUILD_DIR%"
copy /y "%APK_SOURCE%" "%APK_OUT%" >nul
if ERRORLEVEL 1 (
    echo [ERROR] Failed to copy APK to %BUILD_DIR%
    pause
    exit /b 1
)

echo.
echo ============================================
echo   BUILD SUCCESSFUL
echo ============================================
echo.
for %%A in ("%APK_OUT%") do (
    set /a "SIZE_MB=%%~zA / 1048576"
    echo   APK  : %%~nxA
    echo   Size : %%~zA bytes (~!SIZE_MB! MB^)
)
echo   Saved: %BUILD_DIR%
echo.

echo [ADB] Checking for connected devices...
adb kill-server >nul 2>&1
adb start-server >nul 2>&1
timeout /t 2 /nobreak >nul

set "DEVICE_FOUND=0"
for /f "skip=1 tokens=1,2" %%A in ('adb devices 2^>nul') do (
    if "%%B"=="device" (
        set "DEVICE_FOUND=1"
        set "DEVICE_ID=%%A"
    )
)

if "!DEVICE_FOUND!"=="1" (
    echo [ADB] Device: !DEVICE_ID! - installing APK...
    adb -s !DEVICE_ID! install -r "%APK_OUT%"
    if ERRORLEVEL 1 (
        echo [WARN] ADB install failed. Install manually from the path above.
    ) else (
        echo [OK] Installed on !DEVICE_ID!
    )
) else (
    echo [INFO] No ADB device detected.
    echo [INFO] To install: copy the APK to your phone and open it.
)

echo.
echo Done! Press any key to close.
pause >nul
