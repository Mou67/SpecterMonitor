@echo off
title Network Task Manager - Startup
echo ============================================
echo   Network Task Manager - Control Center
echo ============================================
echo.

:: Check Python
where python >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Python nicht gefunden. Bitte Python installieren.
    pause
    exit /b 1
)

:: Check Node
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Node.js nicht gefunden. Bitte Node.js installieren.
    pause
    exit /b 1
)

:: Detect LAN IP
for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /c:"IPv4"') do (
    for /f "tokens=1" %%b in ("%%a") do set LANIP=%%b
)
if not defined LANIP set LANIP=localhost

:: Install Python dependencies
echo [1/3] Python Abhaengigkeiten installieren...
cd /d "%~dp0backend"
pip install -r requirements.txt --quiet

:: Install Node dependencies
echo [2/3] Node.js Abhaengigkeiten installieren...
cd /d "%~dp0frontend"
if not exist node_modules (
    call npm install
) else (
    echo      node_modules vorhanden, ueberspringe...
)

:: Start Backend (inkl. UDP Beacon fuer Auto-Discovery)
echo [3/3] Server starten...
echo.
echo  ============================================
echo   LAN IP:    %LANIP%
echo.
echo   Backend:   http://%LANIP%:8765
echo   Dashboard: http://%LANIP%:3000
echo   Beacon:    UDP Port 47761 (Auto-Discovery)
echo.
echo   Andere PCs: einfach "python agent.py" starten
echo   Der Agent findet den Server automatisch!
echo  ============================================
echo.

cd /d "%~dp0backend"
start "Network Task Manager - Backend" cmd /k "python main.py"

:: Wait a moment for backend to start
timeout /t 2 /nobreak >nul

:: Start Frontend
cd /d "%~dp0frontend"
start "Network Task Manager - Frontend" cmd /k "npm run dev"

echo.
echo Beide Server gestartet!
echo Oeffne http://%LANIP%:3000 im Browser (auch von anderen PCs).
echo.
echo Falls Zugriff von anderen PCs blockiert wird:
echo   PowerShell als Admin: .\setup-firewall.ps1
echo.
pause
