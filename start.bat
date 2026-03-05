@echo off
setlocal enabledelayedexpansion
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
::  STEP 1: Check for Administrator privileges
:: ──────────────────────────────────────────────
echo  [1/6] Checking Administrator privileges...
net session >nul 2>&1
if !errorlevel! neq 0 (
    echo         Not running as Administrator. Requesting elevation...
    echo.
    powershell -Command "Start-Process cmd -ArgumentList '/c \"\"%~f0\"\"' -Verb RunAs"
    exit /b 0
)
echo         Running as Administrator.

:: ──────────────────────────────────────────────
::  PRE-CHECK: Apply pending self-update
:: ──────────────────────────────────────────────
if exist "%~dp0start.bat.new" (
    echo.
    echo  [UPDATE] Pending update found. Applying...
    copy /y "%~dp0start.bat.new" "%~dp0start.bat" >nul
    del "%~dp0start.bat.new" >nul 2>&1
    echo  [UPDATE] Update applied. Restarting...
    start "" "%~dp0start.bat"
    exit /b 0
)

:: ──────────────────────────────────────────────
::  PRE-CHECK: Check GitHub for newer VERSION
:: ──────────────────────────────────────────────
echo  [PRE] Checking for updates...
if exist "%~dp0VERSION" (
    set /p LOCAL_VER=<"%~dp0VERSION"
) else (
    set "LOCAL_VER=0.0.0"
)
for /f "tokens=*" %%r in ('powershell -NoProfile -Command ^
    "try { $r = Invoke-RestMethod -Uri 'https://api.github.com/repos/SpecterMonitor/SpecterMonitor/releases/latest' -TimeoutSec 5 -UseBasicParsing -ErrorAction Stop; $r.tag_name -replace '^v',''; } catch { Write-Output '' }" 2^>nul') do (
    set "REMOTE_VER=%%r"
)
if defined REMOTE_VER (
    if not "!REMOTE_VER!"=="" (
        if not "!REMOTE_VER!"=="!LOCAL_VER!" (
            echo         Neue Version verfuegbar: v!REMOTE_VER! (lokal: v!LOCAL_VER!^)
            echo         Starte die Desktop-App fuer ein automatisches Update,
            echo         oder lade die neue Version von GitHub herunter.
        ) else (
            echo         Aktuelle Version: v!LOCAL_VER! - kein Update noetig.
        )
    ) else (
        echo         Update-Check uebersprungen (offline/kein Zugriff^).
    )
) else (
    echo         Update-Check uebersprungen (offline/kein Zugriff^).
)

:: ──────────────────────────────────────────────
::  STEP 2: Select Mode
:: ──────────────────────────────────────────────
echo.
echo  [2/6] Select startup mode:
echo.
echo   [1] Server + Dashboard  (this PC is the host)
echo   [2] Client only         (this PC sends data to a host)
echo   [3] Server only         (no dashboard)
echo.
set "STARTMODE=1"
set /p STARTMODE="  Your choice [1/2/3] (default=1): "

if "!STARTMODE!"=="2" (
    set "NEED_NODE=0"
    set "NEED_SERVER_DEPS=0"
    set "NEED_CLIENT_DEPS=1"
) else if "!STARTMODE!"=="3" (
    set "NEED_NODE=0"
    set "NEED_SERVER_DEPS=1"
    set "NEED_CLIENT_DEPS=0"
) else (
    set "STARTMODE=1"
    set "NEED_NODE=1"
    set "NEED_SERVER_DEPS=1"
    set "NEED_CLIENT_DEPS=0"
)

:: ──────────────────────────────────────────────
::  STEP 3: Install Python (always needed)
:: ──────────────────────────────────────────────
echo.
echo  [3/6] Checking Python...
where python >nul 2>&1
if !errorlevel! neq 0 (
    echo         Python not found. Installing via winget...
    where winget >nul 2>&1
    if !errorlevel! neq 0 (
        echo.
        echo  [ERROR] winget not found. Cannot auto-install Python.
        echo          Please install Python manually: https://www.python.org/downloads/
        echo          Then restart this script.
        echo.
        pause
        exit /b 1
    )
    winget install Python.Python.3.12 --accept-package-agreements --accept-source-agreements
    if !errorlevel! neq 0 (
        echo.
        echo  [ERROR] Python installation failed.
        echo          Please install Python manually: https://www.python.org/downloads/
        echo.
        pause
        exit /b 1
    )
    echo         Python installed. Refreshing PATH...
    call :refresh_path
    where python >nul 2>&1
    if !errorlevel! neq 0 (
        echo.
        echo  [ERROR] Python was installed but is still not in PATH.
        echo          Please close this window and run start.bat again.
        echo.
        pause
        exit /b 1
    )
)
for /f "tokens=*" %%v in ('python --version 2^>^&1') do set "PYVER=%%v"
echo         OK: !PYVER!

:: Ensure pip is available and up to date
echo         Checking pip...
python -m ensurepip --upgrade >nul 2>&1
python -m pip install --upgrade pip --quiet >nul 2>&1

:: ──────────────────────────────────────────────
::  STEP 4: Install Node.js (only if needed)
:: ──────────────────────────────────────────────
echo  [4/6] Checking Node.js...
if "!NEED_NODE!"=="0" (
    echo         Skipped (not needed for this mode^).
    goto :step5
)
where node >nul 2>&1
if !errorlevel! neq 0 (
    echo         Node.js not found. Installing via winget...
    where winget >nul 2>&1
    if !errorlevel! neq 0 (
        echo.
        echo  [ERROR] winget not found. Cannot auto-install Node.js.
        echo          Please install Node.js manually: https://nodejs.org/
        echo          Then restart this script.
        echo.
        pause
        exit /b 1
    )
    winget install OpenJS.NodeJS.LTS --accept-package-agreements --accept-source-agreements
    if !errorlevel! neq 0 (
        echo.
        echo  [ERROR] Node.js installation failed.
        echo          Please install Node.js manually: https://nodejs.org/
        echo.
        pause
        exit /b 1
    )
    echo         Node.js installed. Refreshing PATH...
    call :refresh_path
    where node >nul 2>&1
    if !errorlevel! neq 0 (
        echo.
        echo  [ERROR] Node.js was installed but is still not in PATH.
        echo          Please close this window and run start.bat again.
        echo.
        pause
        exit /b 1
    )
)
for /f "tokens=*" %%v in ('node --version 2^>^&1') do set "NODEVER=%%v"
echo         OK: Node !NODEVER!

:step5
:: ──────────────────────────────────────────────
::  STEP 5: Install dependencies
:: ──────────────────────────────────────────────
echo  [5/6] Installing dependencies...

if "!NEED_SERVER_DEPS!"=="1" (
    echo         Installing server Python packages...
    cd /d "%~dp0server"
    python -m pip install -r requirements.txt
    if !errorlevel! neq 0 (
        echo         Retrying with --user flag...
        python -m pip install -r requirements.txt --user
        if !errorlevel! neq 0 (
            echo.
            echo  [ERROR] Server dependencies failed to install.
            echo          Try manually: cd "%~dp0server" ^&^& python -m pip install -r requirements.txt
            echo.
            pause
            exit /b 1
        )
    )
    echo         Server packages installed.
)

if "!NEED_CLIENT_DEPS!"=="1" (
    echo         Installing client Python packages...
    cd /d "%~dp0client"
    python -m pip install -r requirements.txt
    if !errorlevel! neq 0 (
        echo         Retrying with --user flag...
        python -m pip install -r requirements.txt --user
        if !errorlevel! neq 0 (
            echo.
            echo  [ERROR] Client dependencies failed to install.
            echo          Try manually: cd "%~dp0client" ^&^& python -m pip install -r requirements.txt
            echo.
            pause
            exit /b 1
        )
    )
    echo         Client packages installed.
)

if "!NEED_NODE!"=="1" (
    echo         Installing dashboard Node.js packages...
    cd /d "%~dp0dashboard"
    if not exist node_modules (
        call npm install
        if !errorlevel! neq 0 (
            echo.
            echo  [ERROR] npm install failed.
            echo          Try manually: cd "%~dp0dashboard" ^&^& npm install
            echo.
            pause
            exit /b 1
        )
    ) else (
        echo         node_modules already present, skipping.
    )
    echo         Building dashboard for production...
    call npm run build
    if !errorlevel! neq 0 (
        echo.
        echo  [ERROR] Dashboard build failed.
        echo          Try manually: cd "%~dp0dashboard" ^&^& npm run build
        echo.
        pause
        exit /b 1
    )
    echo         Dashboard built successfully.

    echo         Installing Electron desktop app packages...
    cd /d "%~dp0"
    if not exist node_modules (
        call npm install
        if !errorlevel! neq 0 (
            echo.
            echo  [WARNING] Electron install failed. Desktop app will not be available.
            echo            The dashboard will still work in your browser.
            echo.
        )
    ) else (
        echo         Electron packages already present, skipping.
    )
)

echo         All dependencies ready.

:: ──────────────────────────────────────────────
::  STEP 6: Firewall, IP detection, and launch
:: ──────────────────────────────────────────────
echo  [6/6] Configuring and launching...

:: Configure firewall
cd /d "%~dp0"
if exist "setup-firewall.ps1" (
    echo         Setting up firewall rules...
    powershell -ExecutionPolicy Bypass -File "%~dp0setup-firewall.ps1"
) else (
    echo         [WARNING] setup-firewall.ps1 not found, skipping firewall.
)

:: Detect primary LAN IP (filter out virtual adapters)
set "LANIP="
for /f "usebackq tokens=*" %%a in (`powershell -NoProfile -Command ^
    "(Get-NetIPConfiguration | Where-Object { $_.IPv4DefaultGateway -ne $null -and $_.NetAdapter.Status -eq 'Up' } | Select-Object -First 1).IPv4Address.IPAddress"`) do (
    set "LANIP=%%a"
)
if not defined LANIP (
    for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /c:"IPv4"') do (
        for /f "tokens=1" %%b in ("%%a") do (
            if not defined LANIP set "LANIP=%%b"
        )
    )
)
if not defined LANIP set "LANIP=localhost"

:: ── Launch based on selected mode ────────────

:: Kill any processes still occupying our ports from a previous run
echo         Cleaning up old processes...
call :kill_port 8765
call :kill_port 3000

if "!STARTMODE!"=="2" goto :launch_client
if "!STARTMODE!"=="3" goto :launch_server
goto :launch_both

:: ── Client Only ──────────────────────────────
:launch_client
echo.
echo  =====================================================
echo   SpecterMonitor - Client Agent
echo  =====================================================
echo.
echo   This PC:  %LANIP%
echo   Mode:     Client (sends metrics to server)
echo.
echo   The agent will auto-discover the server via
echo   UDP beacon on port 47761.
echo.
echo  =====================================================
echo.
cd /d "%~dp0client"
start "SpecterMonitor - Client Agent" cmd /k "python agent.py"
echo  Client agent started!
echo.
pause
goto :eof

:: ── Server Only ──────────────────────────────
:launch_server
echo.
echo  =====================================================
echo   SpecterMonitor - Server
echo  =====================================================
echo.
echo   LAN IP:   %LANIP%
echo   Server:   http://%LANIP%:8765
echo   Beacon:   UDP Port 47761
echo.
echo  =====================================================
echo.
cd /d "%~dp0server"
start "SpecterMonitor - Server" cmd /k "python main.py"
echo  Server started!
echo.
pause
goto :eof

:: ── Server + Dashboard ───────────────────────
:launch_both
echo.
echo  =====================================================
echo   SpecterMonitor - Full Setup
echo  =====================================================
echo.
echo   LAN IP:     %LANIP%
echo.
echo   Server:     http://%LANIP%:8765
echo   Dashboard:  http://%LANIP%:3000
echo   Beacon:     UDP Port 47761 (Auto-Discovery)
echo.
echo   Remote PCs: run start.bat and choose [2] Client
echo   The agent finds the server automatically!
echo.
echo  =====================================================
echo.

cd /d "%~dp0server"
start "SpecterMonitor - Server" cmd /k "python main.py"

echo  Waiting for server to start...
timeout /t 4 /nobreak >nul

:: Verify server is reachable
powershell -NoProfile -Command ^
    "try { $r = Invoke-WebRequest -Uri 'http://localhost:8765/api/snapshot' -TimeoutSec 5 -UseBasicParsing; Write-Host '  [OK] Server is running.' -ForegroundColor Green } catch { Write-Host '  [WARNING] Server may not be ready yet. Check the server window.' -ForegroundColor Yellow }"

cd /d "%~dp0dashboard"
start "SpecterMonitor - Dashboard" cmd /k "npm run start"

echo.
echo  Waiting for dashboard to start...
timeout /t 5 /nobreak >nul

:: Launch Electron desktop app if available
cd /d "%~dp0"
where npx >nul 2>&1
if !errorlevel! equ 0 (
    if exist "node_modules\electron" (
        echo  Launching SpecterMonitor Desktop App...
        start "SpecterMonitor - Desktop" cmd /c "npx electron ."
    ) else (
        echo  [INFO] Electron not installed. Open http://%LANIP%:3000 in your browser.
    )
) else (
    echo  [INFO] npx not found. Open http://%LANIP%:3000 in your browser.
)

echo.
echo  All services started!
echo.
echo  ─────────────────────────────────────────────
echo   Troubleshooting (if other PCs cannot connect):
echo  ─────────────────────────────────────────────
echo   1. Both PCs must be on the same network/subnet
echo   2. Run start.bat as Admin on BOTH PCs
echo   3. Firewall rules are set automatically
echo   4. Try: http://%LANIP%:8765/api/snapshot in browser
echo  ─────────────────────────────────────────────
echo.
pause
goto :eof

:: ══════════════════════════════════════════════
::  FUNCTIONS
:: ══════════════════════════════════════════════

:refresh_path
:: Reload PATH from registry so newly installed programs are found
:: without needing to restart the terminal
for /f "usebackq tokens=2,*" %%A in (`reg query "HKLM\SYSTEM\CurrentControlSet\Control\Session Manager\Environment" /v Path 2^>nul`) do set "SYS_PATH=%%B"
for /f "usebackq tokens=2,*" %%A in (`reg query "HKCU\Environment" /v Path 2^>nul`) do set "USR_PATH=%%B"
set "PATH=!SYS_PATH!;!USR_PATH!"
goto :eof

:kill_port
:: Kill any process listening on the given port
:: Usage: call :kill_port 8765
set "_port=%~1"
for /f "tokens=5" %%p in ('netstat -aon ^| findstr "LISTENING" ^| findstr ":!_port! " 2^>nul') do (
    if "%%p" neq "0" (
        taskkill /F /PID %%p >nul 2>&1
    )
)
goto :eof
