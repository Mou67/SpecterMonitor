; ============================================
; SpecterMonitor - Inno Setup Script
; ============================================
; Packt alle Projektdateien in eine einzige
; SpecterMonitor_Setup.exe fuer One-Click-Installation.
;
; Voraussetzung: Inno Setup 6.x installiert
;   https://jrsoftware.org/isinfo.php
;
; Kompilieren:
;   1. Inno Setup oeffnen
;   2. Diese .iss Datei laden
;   3. Ctrl+F9 (Compile)
;   4. Die EXE liegt danach in Output/
; ============================================

#define MyAppName "SpecterMonitor"
#define MyAppVersion "1.0.0"
#define MyAppPublisher "SpecterMonitor"
#define MyAppURL "https://github.com/SpecterMonitor"

[Setup]
AppId={{B8F3A2D1-7E4C-4A9B-8D6F-1C2E3F4A5B6C}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppPublisher={#MyAppPublisher}
AppSupportURL={#MyAppURL}
DefaultDirName={autopf}\{#MyAppName}
DefaultGroupName={#MyAppName}
OutputBaseFilename=SpecterMonitor_Setup
SetupIconFile=
Compression=lzma2/max
SolidCompression=yes
WizardStyle=modern
PrivilegesRequired=admin
ArchitecturesInstallIn64BitMode=x64compatible
DisableProgramGroupPage=yes
LicenseFile=
OutputDir=Output

[Languages]
Name: "english"; MessagesFile: "compiler:Default.isl"
Name: "german"; MessagesFile: "compiler:Languages\German.isl"

[Tasks]
Name: "desktopicon"; Description: "{cm:CreateDesktopIcon}"; GroupDescription: "{cm:AdditionalIcons}"

[Files]
; Start script & firewall setup
Source: "start.bat"; DestDir: "{app}"; Flags: ignoreversion
Source: "setup-firewall.ps1"; DestDir: "{app}"; Flags: ignoreversion

; Electron desktop app
Source: "electron\*"; DestDir: "{app}\electron"; Flags: ignoreversion recursesubdirs createallsubdirs
Source: "package.json"; DestDir: "{app}"; Flags: ignoreversion
Source: "VERSION"; DestDir: "{app}"; Flags: ignoreversion
Source: "CHANGELOG.md"; DestDir: "{app}"; Flags: ignoreversion

; Server (Python backend)
Source: "server\*"; DestDir: "{app}\server"; Flags: ignoreversion recursesubdirs createallsubdirs

; Client (Python agent)
Source: "client\*"; DestDir: "{app}\client"; Flags: ignoreversion recursesubdirs createallsubdirs

; Dashboard (Next.js frontend) - exclude node_modules, .next build cache
Source: "dashboard\*"; DestDir: "{app}\dashboard"; Flags: ignoreversion recursesubdirs createallsubdirs; Excludes: "node_modules\*,.next\*"

; Config files
Source: ".env.example"; DestDir: "{app}"; Flags: ignoreversion
Source: "README.md"; DestDir: "{app}"; Flags: ignoreversion

[Icons]
Name: "{group}\{#MyAppName}"; Filename: "{app}\start.bat"; IconFilename: "{sys}\shell32.dll"; IconIndex: 21; Comment: "Start SpecterMonitor"
Name: "{group}\{cm:UninstallProgram,{#MyAppName}}"; Filename: "{uninstallexe}"
Name: "{autodesktop}\{#MyAppName}"; Filename: "{app}\start.bat"; IconFilename: "{sys}\shell32.dll"; IconIndex: 21; Tasks: desktopicon; Comment: "Start SpecterMonitor"

[Run]
Filename: "{app}\start.bat"; Description: "SpecterMonitor jetzt starten?"; Flags: postinstall nowait shellexec; Check: not WizardSilent

[Code]
// Optional: Custom wizard page or version checks can be added here
