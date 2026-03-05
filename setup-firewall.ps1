# ============================================
# SpecterMonitor - Firewall Setup
# ============================================
# Oeffnet die Ports 3000 (Dashboard), 8765 (Server)
# und 47761/UDP (Auto-Discovery Beacon) in der
# Windows-Firewall fuer das private Netzwerk.
#
# Wird automatisch von start.bat aufgerufen.
# Kann auch manuell ausgefuehrt werden:
#   Rechtsklick -> "Als Administrator ausfuehren"
# ============================================

#Requires -RunAsAdministrator

$ErrorActionPreference = "Stop"

Write-Host ""
Write-Host "============================================" -ForegroundColor Cyan
Write-Host "  SpecterMonitor - Firewall Setup" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""

# --- Helper function to create or verify a firewall rule ---
function Ensure-FirewallRule {
    param(
        [string]$DisplayName,
        [string]$Protocol,
        [int]$Port,
        [string]$Description
    )

    $existing = Get-NetFirewallRule -DisplayName $DisplayName -ErrorAction SilentlyContinue

    if ($existing) {
        # Update existing rule to cover all profiles
        Set-NetFirewallRule -DisplayName $DisplayName -Profile Any -ErrorAction SilentlyContinue
        Write-Host "[OK] Regel '$DisplayName' existiert bereits (alle Profile aktiv)." -ForegroundColor Green
    } else {
        New-NetFirewallRule `
            -DisplayName $DisplayName `
            -Direction Inbound `
            -Protocol $Protocol `
            -LocalPort $Port `
            -Action Allow `
            -Profile Any `
            -Description $Description | Out-Null
        Write-Host "[+] Regel '$DisplayName' erstellt (alle Profile)." -ForegroundColor Green
    }
}

# Port 3000 - Next.js Dashboard
Ensure-FirewallRule `
    -DisplayName "SpecterMonitor - Dashboard (TCP 3000)" `
    -Protocol TCP `
    -Port 3000 `
    -Description "Erlaubt eingehende Verbindungen zum SpecterMonitor Dashboard"

# Port 8765 - Python Server / WebSocket
Ensure-FirewallRule `
    -DisplayName "SpecterMonitor - Server (TCP 8765)" `
    -Protocol TCP `
    -Port 8765 `
    -Description "Erlaubt eingehende Verbindungen zum SpecterMonitor Server/WebSocket"

# Port 47761 - UDP Auto-Discovery Beacon
Ensure-FirewallRule `
    -DisplayName "SpecterMonitor - Beacon (UDP 47761)" `
    -Protocol UDP `
    -Port 47761 `
    -Description "Erlaubt UDP-Broadcast fuer SpecterMonitor Auto-Discovery im LAN"

Write-Host ""
Write-Host "Fertig! Alle Ports sind jetzt offen (alle Netzwerk-Profile)." -ForegroundColor Green
Write-Host ""

# --- Netzwerk-Profil anzeigen ---
$profiles = Get-NetConnectionProfile -ErrorAction SilentlyContinue
if ($profiles) {
    Write-Host "Aktive Netzwerk-Profile:" -ForegroundColor Cyan
    foreach ($p in $profiles) {
        $color = if ($p.NetworkCategory -eq "Public") { "Red" } else { "Green" }
        Write-Host "  $($p.InterfaceAlias): $($p.NetworkCategory)" -ForegroundColor $color
    }

    $publicNets = $profiles | Where-Object { $_.NetworkCategory -eq "Public" }
    if ($publicNets) {
        Write-Host ""
        Write-Host "  Hinweis: Firewall-Regeln gelten jetzt fuer ALLE Profile," -ForegroundColor Yellow
        Write-Host "  daher funktioniert es auch mit 'Public' Netzwerken." -ForegroundColor Yellow
    }
}

Write-Host ""

# --- Aktuelle LAN-IP anzeigen (virtuelle Adapter filtern) ---
$ip = (Get-NetIPConfiguration |
    Where-Object {
        $_.IPv4DefaultGateway -ne $null -and
        $_.NetAdapter.Status -eq "Up"
    } |
    Select-Object -First 1
).IPv4Address.IPAddress

if ($ip) {
    Write-Host "Deine LAN-IP: $ip" -ForegroundColor Yellow
    Write-Host "Dashboard:    http://${ip}:3000" -ForegroundColor Yellow
    Write-Host "Server:       http://${ip}:8765" -ForegroundColor Yellow
} else {
    Write-Host "LAN-IP konnte nicht ermittelt werden." -ForegroundColor DarkYellow
    Write-Host "Dashboard:    http://localhost:3000" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "Zum Entfernen aller SpecterMonitor-Regeln:" -ForegroundColor DarkGray
Write-Host "  Get-NetFirewallRule -DisplayName 'SpecterMonitor*' | Remove-NetFirewallRule" -ForegroundColor DarkGray
Write-Host ""
