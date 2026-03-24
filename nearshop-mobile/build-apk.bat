@echo off
setlocal EnableDelayedExpansion

echo ============================================
echo   NearShop APK Builder (Release)
echo ============================================
echo.

:: ── 1. Set environment ────────────────────────
set "JAVA_HOME=C:\Program Files\Android\Android Studio\jbr"
set "ANDROID_HOME=%LOCALAPPDATA%\Android\Sdk"
set "PATH=%JAVA_HOME%\bin;%ANDROID_HOME%\platform-tools;%PATH%"

:: Give Node.js (Metro bundler) more heap — prevents OOM during JS bundling
set "NODE_OPTIONS=--max_old_space_size=4096"

:: Give Gradle extra JVM memory on top of gradle.properties
set "_JAVA_OPTIONS=-Xmx3072m -XX:MaxMetaspaceSize=512m"

echo [INFO] JAVA_HOME = %JAVA_HOME%
echo [INFO] ANDROID_HOME = %ANDROID_HOME%
echo.

:: Verify Java
"%JAVA_HOME%\bin\java.exe" -version >nul 2>&1
if ERRORLEVEL 1 (
    echo [ERROR] Java not found at %JAVA_HOME%
    echo         Make sure Android Studio is installed.
    pause & exit /b 1
)

:: ── 2. Change to android/ folder ──────────────
set "SCRIPT_DIR=%~dp0"
cd /d "%SCRIPT_DIR%android"
if ERRORLEVEL 1 (
    echo [ERROR] android/ folder not found.
    pause & exit /b 1
)

:: ── 3. Build RELEASE APK (standalone, no Metro needed) ──
echo [BUILD] Running Gradle assembleRelease...
echo         Architecture: arm64-v8a only (all modern Android phones)
echo         Bundles JS + assets into APK. Works on any Android device.
echo         First run: 5-10 min. Subsequent runs: ~2 min.
echo.
call gradlew.bat assembleRelease --no-daemon -Dorg.gradle.jvmargs="-Xmx3072m -XX:MaxMetaspaceSize=512m"

:: ── 4. Check build result ─────────────────────
if ERRORLEVEL 1 (
    echo.
    echo [FAILED] Gradle build failed. Check output above.
    pause & exit /b 1
)

:: ── 5. Verify APK file ────────────────────────
set "APK_PATH=%SCRIPT_DIR%android\app\build\outputs\apk\release\app-release.apk"
if not exist "%APK_PATH%" (
    echo [ERROR] APK not found at: %APK_PATH%
    pause & exit /b 1
)

:: ── 6. Print APK info ─────────────────────────
echo.
echo ============================================
echo   BUILD SUCCESSFUL
echo ============================================
echo.
echo APK location:
echo   %APK_PATH%
echo.

:: Copy to builds/ folder
if not exist "%SCRIPT_DIR%builds" mkdir "%SCRIPT_DIR%builds"
copy /y "%APK_PATH%" "%SCRIPT_DIR%builds\nearshop-release.apk" >nul
echo Copied to: %SCRIPT_DIR%builds\nearshop-release.apk
echo.
echo  --> Share this APK file directly to any Android device.
echo      No developer mode, no USB debugging, no Metro needed.
echo      Just enable "Install from unknown sources" in phone settings.
echo.

:: Show file size
for %%A in ("%APK_PATH%") do (
    set /a "SIZE_MB=%%~zA / 1048576"
    echo APK size: %%~zA bytes (~!SIZE_MB! MB)
)
echo.

:: ── 7. Auto-install if ADB device connected ───
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
    echo [ADB] Device found: !DEVICE_ID! — installing...
    adb -s !DEVICE_ID! install -r "%APK_PATH%"
    if ERRORLEVEL 1 (
        echo [WARN] ADB install failed. Install manually using the APK file above.
    ) else (
        echo [OK] Installed on !DEVICE_ID!
        adb -s !DEVICE_ID! shell am start -n com.nearshop.app/.MainActivity >nul 2>&1
    )
) else (
    echo [INFO] No ADB device found.
    echo [INFO] To install: copy nearshop-release.apk to your phone and open it.
)

echo.
echo Done!
pause
