@echo off
setlocal enabledelayedexpansion
title Truck Loading Optimizer — Build

echo.
echo  ============================================
echo   Truck Loading Optimizer — Windows Builder
echo  ============================================
echo.

:: ── Check Python ────────────────────────────────────────────────────────
python --version >nul 2>&1
if errorlevel 1 (
    echo  [ERROR] Python is not installed or not in PATH.
    echo          Download it from https://www.python.org/downloads/
    echo          Make sure to tick "Add Python to PATH" during install.
    echo.
    pause
    exit /b 1
)
for /f "tokens=*" %%v in ('python --version 2^>^&1') do set PYVER=%%v
echo  [OK] Found %PYVER%
echo.

:: ── Install / upgrade dependencies ──────────────────────────────────────
echo  [1/3] Installing dependencies...
python -m pip install --upgrade --quiet flask pyinstaller
if errorlevel 1 (
    echo  [ERROR] pip install failed.
    pause
    exit /b 1
)
echo  [OK] Dependencies ready.
echo.

:: ── Clean previous build ────────────────────────────────────────────────
if exist build   rmdir /s /q build
if exist dist    rmdir /s /q dist
if exist TruckLoadingOptimizer.spec del /q TruckLoadingOptimizer.spec

:: ── Build with PyInstaller ───────────────────────────────────────────────
echo  [2/3] Building executable (this may take a minute)...
echo.

python -m PyInstaller ^
    --noconfirm ^
    --onefile ^
    --console ^
    --name "TruckLoadingOptimizer" ^
    --add-data "templates;templates" ^
    --add-data "static;static" ^
    --hidden-import=packing ^
    --hidden-import=flask ^
    --hidden-import=werkzeug ^
    --hidden-import=jinja2 ^
    --hidden-import=click ^
    launcher.py

echo.

:: ── Report result ────────────────────────────────────────────────────────
if exist "dist\TruckLoadingOptimizer.exe" (
    echo  [3/3] Done!
    echo.
    echo  ============================================
    echo   OUTPUT: dist\TruckLoadingOptimizer.exe
    echo  ============================================
    echo.
    echo   Share that single .exe file with any Windows
    echo   user — no Python installation required.
    echo.
    echo   Double-click it to start the server and open
    echo   the app in the default browser automatically.
    echo.
) else (
    echo  [ERROR] Build failed. Check the output above for details.
    echo.
)

pause
endlocal
