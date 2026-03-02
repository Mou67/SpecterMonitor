# ============================================
# Network Task Manager - Firewall Setup
# ============================================
# Dieses Skript oeffnet die Ports 3000 (Frontend)
# und 8765 (Backend) in der Windows-Firewall.
#
# MUSS als Administrator ausgefuehrt werden!
# Rechtsklick -> "Als Administrator ausfuehren"
# ============================================

#Requires -RunAsAdministrator

$ErrorActionPreference = "Stop"

Write-Host ""
Write-Host "============================================" -ForegroundColor Cyan
Write-Host "  Network Task Manager - Firewall Setup" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""

# Port 3000 - Next.js Frontend
$ruleName3000 = "Network Task Manager - Frontend (TCP 3000)"
$existing3000 = Get-NetFirewallRule -DisplayName $ruleName3000 -ErrorAction SilentlyContinue

if ($existing3000) {
    Write-Host "[OK] Regel '$ruleName3000' existiert bereits." -ForegroundColor Green
} else {
    New-NetFirewallRule `
        -DisplayName $ruleName3000 `
        -Direction Inbound `
        -Protocol TCP `
        -LocalPort 3000 `
        -Action Allow `
        -Profile Private `
        -Description "Erlaubt eingehende Verbindungen zum Network Task Manager Frontend"
    Write-Host "[+] Regel '$ruleName3000' erstellt." -ForegroundColor Green
}

# Port 8765 - FastAPI Backend / WebSocket
$ruleName8765 = "Network Task Manager - Backend (TCP 8765)"
$existing8765 = Get-NetFirewallRule -DisplayName $ruleName8765 -ErrorAction SilentlyContinue

if ($existing8765) {
    Write-Host "[OK] Regel '$ruleName8765' existiert bereits." -ForegroundColor Green
} else {
    New-NetFirewallRule `
        -DisplayName $ruleName8765 `
        -Direction Inbound `
        -Protocol TCP `
        -LocalPort 8765 `
        -Action Allow `
        -Profile Private `
        -Description "Erlaubt eingehende Verbindungen zum Network Task Manager Backend/WebSocket"
    Write-Host "[+] Regel '$ruleName8765' erstellt." -ForegroundColor Green
}

Write-Host ""
Write-Host "Fertig! Beide Ports sind jetzt im privaten Netzwerk offen." -ForegroundColor Green
Write-Host ""

# Aktuelle LAN-IP anzeigen
$ip = (Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.InterfaceAlias -notlike "*Loopback*" -and $_.IPAddress -notlike "169.*" } | Select-Object -First 1).IPAddress
if ($ip) {
    Write-Host "Deine LAN-IP: $ip" -ForegroundColor Yellow
    Write-Host "Dashboard:    http://${ip}:3000" -ForegroundColor Yellow
    Write-Host "Backend:      http://${ip}:8765" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "Zum Entfernen der Regeln:" -ForegroundColor DarkGray
Write-Host "  Remove-NetFirewallRule -DisplayName '$ruleName3000'" -ForegroundColor DarkGray
Write-Host "  Remove-NetFirewallRule -DisplayName '$ruleName8765'" -ForegroundColor DarkGray
Write-Host ""
