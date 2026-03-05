@echo off
setlocal enabledelayedexpansion
title SpecterMonitor - Full Setup
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
echo   Full Setup - Installiert ALLES was du brauchst
echo  =====================================================
echo.
echo   Dieses Script installiert:
echo     - Python 3.12
echo     - Node.js LTS
echo     - Alle Server-Pakete (pip)
echo     - Alle Client-Pakete (pip)
echo     - Alle Dashboard-Pakete (npm)
echo     - Dashboard Production Build
echo     - Firewall-Regeln
echo     - Desktop-Verknuepfung
echo.
echo  =====================================================
echo.

:: ──────────────────────────────────────────────
::  STEP 1: Administrator pruefen
:: ──────────────────────────────────────────────
echo  [1/8] Pruefe Administrator-Rechte...
net session >nul 2>&1
if !errorlevel! neq 0 (
    echo         Keine Admin-Rechte. Fordere Elevation an...
    echo.
    powershell -Command "Start-Process cmd -ArgumentList '/c \"\"%~f0\"\"' -Verb RunAs"
    exit /b 0
)
echo         [OK] Laeuft als Administrator.
set "ERRORS=0"

:: ──────────────────────────────────────────────
::  STEP 2: Python installieren
:: ──────────────────────────────────────────────
echo.
echo  [2/8] Python...
where python >nul 2>&1
if !errorlevel! neq 0 (
    echo         Python nicht gefunden. Installiere via winget...
    where winget >nul 2>&1
    if !errorlevel! neq 0 (
        echo.
        echo  [FEHLER] winget nicht gefunden.
        echo           Bitte installiere Python manuell: https://www.python.org/downloads/
        echo.
        pause
        exit /b 1
    )
    winget install Python.Python.3.12 --accept-package-agreements --accept-source-agreements
    if !errorlevel! neq 0 (
        echo  [FEHLER] Python-Installation fehlgeschlagen.
        pause
        exit /b 1
    )
    echo         Aktualisiere PATH...
    call :refresh_path
    where python >nul 2>&1
    if !errorlevel! neq 0 (
        echo  [FEHLER] Python nach Installation nicht in PATH.
        echo           Bitte Fenster schliessen und full-setup.bat erneut starten.
        pause
        exit /b 1
    )
) else (
    echo         Bereits installiert.
)
for /f "tokens=*" %%v in ('python --version 2^>^&1') do set "PYVER=%%v"
echo         [OK] !PYVER!

:: pip aktualisieren
echo         Aktualisiere pip...
python -m ensurepip --upgrade >nul 2>&1
python -m pip install --upgrade pip --quiet >nul 2>&1

:: ──────────────────────────────────────────────
::  STEP 3: Node.js installieren
:: ──────────────────────────────────────────────
echo.
echo  [3/8] Node.js...
where node >nul 2>&1
if !errorlevel! neq 0 (
    echo         Node.js nicht gefunden. Installiere via winget...
    where winget >nul 2>&1
    if !errorlevel! neq 0 (
        echo.
        echo  [FEHLER] winget nicht gefunden.
        echo           Bitte installiere Node.js manuell: https://nodejs.org/
        echo.
        pause
        exit /b 1
    )
    winget install OpenJS.NodeJS.LTS --accept-package-agreements --accept-source-agreements
    if !errorlevel! neq 0 (
        echo  [FEHLER] Node.js-Installation fehlgeschlagen.
        pause
        exit /b 1
    )
    echo         Aktualisiere PATH...
    call :refresh_path
    where node >nul 2>&1
    if !errorlevel! neq 0 (
        echo  [FEHLER] Node.js nach Installation nicht in PATH.
        echo           Bitte Fenster schliessen und full-setup.bat erneut starten.
        pause
        exit /b 1
    )
) else (
    echo         Bereits installiert.
)
for /f "tokens=*" %%v in ('node --version 2^>^&1') do set "NODEVER=%%v"
echo         [OK] Node !NODEVER!

:: ──────────────────────────────────────────────
::  STEP 4: Server-Pakete (Python)
:: ──────────────────────────────────────────────
echo.
echo  [4/8] Server-Pakete (pip)...
cd /d "%~dp0server"
python -m pip install -r requirements.txt
if !errorlevel! neq 0 (
    echo         Erneuter Versuch mit --user Flag...
    python -m pip install -r requirements.txt --user
    if !errorlevel! neq 0 (
        echo  [FEHLER] Server-Pakete konnten nicht installiert werden.
        set /a ERRORS+=1
    )
)
echo         [OK] Server-Pakete installiert.

:: ──────────────────────────────────────────────
::  STEP 5: Client-Pakete (Python)
:: ──────────────────────────────────────────────
echo.
echo  [5/8] Client-Pakete (pip)...
cd /d "%~dp0client"
python -m pip install -r requirements.txt
if !errorlevel! neq 0 (
    echo         Erneuter Versuch mit --user Flag...
    python -m pip install -r requirements.txt --user
    if !errorlevel! neq 0 (
        echo  [FEHLER] Client-Pakete konnten nicht installiert werden.
        set /a ERRORS+=1
    )
)
echo         [OK] Client-Pakete installiert.

:: ──────────────────────────────────────────────
::  STEP 6: Dashboard-Pakete (npm) + Build
:: ──────────────────────────────────────────────
echo.
echo  [6/8] Dashboard-Pakete (npm) ^& Production Build...
cd /d "%~dp0dashboard"
echo         npm install...
call npm install
if !errorlevel! neq 0 (
    echo  [FEHLER] npm install fehlgeschlagen.
    set /a ERRORS+=1
    goto :step7
)
echo         npm run build...
call npm run build
if !errorlevel! neq 0 (
    echo  [FEHLER] Dashboard-Build fehlgeschlagen.
    set /a ERRORS+=1
    goto :step7
)
echo         [OK] Dashboard gebaut.

:step7
:: ──────────────────────────────────────────────
::  STEP 7: Firewall-Regeln
:: ──────────────────────────────────────────────
echo.
echo  [7/8] Firewall-Regeln...
cd /d "%~dp0"
if exist "setup-firewall.ps1" (
    powershell -ExecutionPolicy Bypass -File "%~dp0setup-firewall.ps1"
    echo         [OK] Firewall konfiguriert.
) else (
    echo         [WARNUNG] setup-firewall.ps1 nicht gefunden.
    set /a ERRORS+=1
)

:: ──────────────────────────────────────────────
::  STEP 8: Desktop-Verknuepfung
:: ──────────────────────────────────────────────
echo.
echo  [8/8] Desktop-Verknuepfung...
cd /d "%~dp0"
powershell -NoProfile -Command ^
    "$ws = New-Object -ComObject WScript.Shell; $sc = $ws.CreateShortcut([IO.Path]::Combine($ws.SpecialFolders('Desktop'), 'SpecterMonitor.lnk')); $sc.TargetPath = '%~dp0start.bat'; $sc.WorkingDirectory = '%~dp0'; $sc.IconLocation = 'shell32.dll,21'; $sc.Description = 'SpecterMonitor starten'; $sc.Save(); Write-Host '         [OK] Verknuepfung auf Desktop erstellt.'"

:: ──────────────────────────────────────────────
::  Zusammenfassung
:: ──────────────────────────────────────────────

:: LAN-IP ermitteln
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

echo.
echo  =====================================================
if !ERRORS! equ 0 (
    echo   Setup abgeschlossen - ALLES ERFOLGREICH
) else (
    echo   Setup abgeschlossen - !ERRORS! Fehler aufgetreten
)
echo  =====================================================
echo.
echo   Python:      !PYVER!
echo   Node.js:     !NODEVER!
echo   LAN IP:      !LANIP!
echo.
echo   Server:      http://!LANIP!:8765
echo   Dashboard:   http://!LANIP!:3000
echo   Beacon:      UDP 47761 (Auto-Discovery)
echo.
echo   Starten:     start.bat ausfuehren
echo               oder Desktop-Verknuepfung doppelklicken
echo.
echo  =====================================================
echo.
pause
goto :eof

:: ══════════════════════════════════════════════
::  FUNKTIONEN
:: ══════════════════════════════════════════════

:refresh_path
for /f "usebackq tokens=2,*" %%A in (`reg query "HKLM\SYSTEM\CurrentControlSet\Control\Session Manager\Environment" /v Path 2^>nul`) do set "SYS_PATH=%%B"
for /f "usebackq tokens=2,*" %%A in (`reg query "HKCU\Environment" /v Path 2^>nul`) do set "USR_PATH=%%B"
set "PATH=!SYS_PATH!;!USR_PATH!"
goto :eof
