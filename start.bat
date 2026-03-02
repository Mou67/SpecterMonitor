@echo off
title SpecterMonitor - Startup
color 0B
echo.
echo   ____                  _            __  __             _ _
echo  / ___^|_ __   ___  ___^| ^|_ ___ _ __^|  \/  ^| ___  _ __ (_) ^|_ ___  _ __
echo  \___ \ '_ \ / _ \/ __^| __/ _ \ '__^| ^|\/^| ^|/ _ \^| '_ \^| ^| __/ _ \^| '__^|
echo   ___) ^| ^|_) ^|  __/ (__^| ^|^|  __/ ^|  ^| ^|  ^| ^| (_) ^| ^| ^| ^| ^| ^|^| (_) ^| ^|
echo  ^|____/^| .__/ \___^|\___^|\__\___^|_^|  ^|_^|  ^|_^|\___/^|_^| ^|_^|_^|\__\___/^|_^|
echo        ^|_^|
echo.
echo  =====================================================
echo   SpecterMonitor - One-Click Setup ^& Launch
echo  =====================================================
echo.

:: ──────────────────────────────────────────────
::  STEP 1: Check / Install Python
:: ──────────────────────────────────────────────
echo  [1/5] Checking Python...
where python >nul 2>&1
if %errorlevel% neq 0 (
    echo         Python not found. Attempting to install via winget...
    where winget >nul 2>&1
    if %errorlevel% neq 0 (
        echo.
        echo  [ERROR] Neither Python nor winget found.
        echo          Please install Python manually: https://www.python.org/downloads/
        echo.
        pause
        exit /b 1
    )
    winget install Python.Python.3.12 --accept-package-agreements --accept-source-agreements
    if %errorlevel% neq 0 (
        echo.
        echo  [ERROR] Python installation failed.
        echo          Please install Python manually: https://www.python.org/downloads/
        echo.
        pause
        exit /b 1
    )
    echo         Python installed. Please restart this script so PATH is updated.
    pause
    exit /b 0
)
for /f "tokens=*" %%v in ('python --version 2^>^&1') do set PYVER=%%v
echo         Found: %PYVER%

:: ──────────────────────────────────────────────
::  STEP 2: Check / Install Node.js
:: ──────────────────────────────────────────────
echo  [2/5] Checking Node.js...
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo         Node.js not found. Attempting to install via winget...
    where winget >nul 2>&1
    if %errorlevel% neq 0 (
        echo.
        echo  [ERROR] Neither Node.js nor winget found.
        echo          Please install Node.js manually: https://nodejs.org/
        echo.
        pause
        exit /b 1
    )
    winget install OpenJS.NodeJS.LTS --accept-package-agreements --accept-source-agreements
    if %errorlevel% neq 0 (
        echo.
        echo  [ERROR] Node.js installation failed.
        echo          Please install Node.js manually: https://nodejs.org/
        echo.
        pause
        exit /b 1
    )
    echo         Node.js installed. Please restart this script so PATH is updated.
    pause
    exit /b 0
)
for /f "tokens=*" %%v in ('node --version 2^>^&1') do set NODEVER=%%v
echo         Found: Node %NODEVER%

:: ──────────────────────────────────────────────
::  STEP 3: Install Python dependencies
:: ──────────────────────────────────────────────
echo  [3/5] Installing Python dependencies...
cd /d "%~dp0server"
pip install -r requirements.txt --quiet 2>nul
if %errorlevel% neq 0 (
    echo         Retrying with --user flag...
    pip install -r requirements.txt --quiet --user 2>nul
)
echo         Done.

:: ──────────────────────────────────────────────
::  STEP 4: Install Node.js dependencies
:: ──────────────────────────────────────────────
echo  [4/5] Installing Node.js dependencies...
cd /d "%~dp0dashboard"
if not exist node_modules (
    call npm install
) else (
    echo         node_modules found, skipping install.
)
echo         Done.

:: ──────────────────────────────────────────────
::  STEP 5: Detect LAN IP and launch
:: ──────────────────────────────────────────────
echo  [5/5] Starting servers...

:: Detect LAN IP
for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /c:"IPv4"') do (
    for /f "tokens=1" %%b in ("%%a") do set LANIP=%%b
)
if not defined LANIP set LANIP=localhost

echo.
echo  =====================================================
echo.
echo   LAN IP:     %LANIP%
echo.
echo   Server:     http://%LANIP%:8765
echo   Dashboard:  http://%LANIP%:3000
echo   Beacon:     UDP Port 47761 (Auto-Discovery)
echo.
echo   Remote PCs: run "python agent.py" from client/
echo   The agent finds the server automatically!
echo.
echo  =====================================================
echo.

:: Start server
cd /d "%~dp0server"
start "SpecterMonitor - Server" cmd /k "python main.py"

:: Wait for server to initialize
timeout /t 2 /nobreak >nul

:: Start dashboard
cd /d "%~dp0dashboard"
start "SpecterMonitor - Dashboard" cmd /k "npm run dev"

echo.
echo  Both servers started!
echo  Open http://%LANIP%:3000 in your browser (works from any PC on the network).
echo.
echo  If access from other PCs is blocked:
echo    Run PowerShell as Admin: .\setup-firewall.ps1
echo.
pause
