// ═══════════════════════════════════════════════════════════════
//  SpecterMonitor – Electron Main Process
//  Launcher, Process Management, Tray, Auto-Updater
// ═══════════════════════════════════════════════════════════════

const {
  app,
  BrowserWindow,
  Tray,
  Menu,
  ipcMain,
  nativeImage,
  Notification,
  shell,
} = require("electron");
// autoUpdater removed – we download releases directly from GitHub
const { spawn, execSync } = require("child_process");
const path = require("path");
const fs = require("fs");
const http = require("http");
const https = require("https");
const os = require("os");

// ── Configuration ────────────────────────────────────────────
const GITHUB_OWNER = "Mou67";
const GITHUB_REPO = "SpecterMonitor";
const DASHBOARD_URL = "http://localhost:3000";
const SERVER_URL = "http://localhost:8765";
const APP_VERSION = require(path.join(__dirname, "..", "package.json")).version;

// ── Paths ────────────────────────────────────────────────────
const isDev = !app.isPackaged;
const root = isDev ? path.join(__dirname, "..") : process.resourcesPath;
const PATHS = {
  server: path.join(root, "server"),
  dashboard: path.join(root, "dashboard"),
  client: path.join(root, "client"),
};

// ── File Logging ────────────────────────────────────────────
const LOG_FILE = path.join(isDev ? path.join(__dirname, "..") : app.getPath("userData"), "specter-debug.log");
function fileLog(msg) {
  const time = new Date().toISOString();
  const line = `[${time}] ${msg}\n`;
  try { fs.appendFileSync(LOG_FILE, line); } catch {}
}
// Clear old log on start
try { fs.writeFileSync(LOG_FILE, `=== SpecterMonitor started ${new Date().toISOString()} ===\n`); } catch {}
fileLog(`isDev=${isDev} root=${root}`);
fileLog(`PATHS.server=${PATHS.server}`);
fileLog(`PATHS.dashboard=${PATHS.dashboard}`);
fileLog(`PATHS.client=${PATHS.client}`);

// ── State ────────────────────────────────────────────────────
let launcherWindow = null;
let dashboardWindow = null;
let tray = null;
let isQuitting = false;
let pendingUpdateInfo = null;
let statusInterval = null;

// Child processes managed by us
let procs = {
  server: null,
  dashboard: null,
  client: null,
};

// Service status
let status = {
  server: { running: false, starting: false, managed: false },
  dashboard: { running: false, starting: false, managed: false },
  client: { running: false, starting: false, managed: false },
};

// ── Prevent multiple instances ───────────────────────────────
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (launcherWindow) {
      if (launcherWindow.isMinimized()) launcherWindow.restore();
      launcherWindow.show();
      launcherWindow.focus();
    }
  });
}

// ═════════════════════════════════════════════════════════════
//  Helpers
// ═════════════════════════════════════════════════════════════
function createNeonIcon(size) {
  const buffer = Buffer.alloc(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const idx = (y * size + x) * 4;
      const cx = (x - size / 2 + 0.5) / (size / 2);
      const cy = (y - size / 2 + 0.5) / (size / 2);
      const dist = Math.sqrt(cx * cx + cy * cy);
      if (dist < 0.9) {
        const alpha =
          dist < 0.65 ? 255 : Math.round((255 * (0.9 - dist)) / 0.25);
        buffer[idx] = 255;
        buffer[idx + 1] = 240;
        buffer[idx + 2] = 0;
        buffer[idx + 3] = alpha;
      }
    }
  }
  return nativeImage.createFromBitmap(buffer, { width: size, height: size });
}

function checkPort(port) {
  return new Promise((resolve) => {
    const req = http.get(`http://localhost:${port}`, () => resolve(true));
    req.on("error", () => resolve(false));
    req.setTimeout(1500, () => {
      req.destroy();
      resolve(false);
    });
  });
}

function killPort(port) {
  try {
    const out = execSync(
      `netstat -aon | findstr "LISTENING" | findstr ":${port} "`,
      { encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] }
    );
    for (const line of out.trim().split("\n")) {
      const parts = line.trim().split(/\s+/);
      const pid = parts[parts.length - 1];
      if (pid && pid !== "0") {
        try {
          execSync(`taskkill /T /F /PID ${pid}`, { stdio: "ignore" });
        } catch {}
      }
    }
  } catch {}
}

function getLanIp() {
  const nets = os.networkInterfaces();
  for (const name of Object.keys(nets)) {
    // Skip virtual adapters
    if (/virtual|docker|veth|wsl|vmware|hyper-v/i.test(name)) continue;
    for (const net of nets[name]) {
      if (net.family === "IPv4" && !net.internal) return net.address;
    }
  }
  return "localhost";
}

function sendLog(msg, type = "") {
  if (launcherWindow && !launcherWindow.isDestroyed()) {
    launcherWindow.webContents.send("log", msg, type);
  }
}

function sendStatus() {
  if (launcherWindow && !launcherWindow.isDestroyed()) {
    launcherWindow.webContents.send("status-update", status);
  }
}

// ═════════════════════════════════════════════════════════════
//  Process Management
// ═════════════════════════════════════════════════════════════
function startServer() {
  if (status.server.running || status.server.starting) return;
  status.server.starting = true;
  sendStatus();
  sendLog("Server wird gestartet...", "info");
  fileLog(`startServer() cwd=${PATHS.server}`);
  fileLog(`startServer() checking cwd exists: ${fs.existsSync(PATHS.server)}`);

  procs.server = spawn("cmd.exe", ["/c", "python main.py"], {
    cwd: PATHS.server,
    stdio: ["ignore", "pipe", "pipe"],
  });

  fileLog(`startServer() spawned PID=${procs.server.pid}`);

  procs.server.on("error", (err) => {
    fileLog(`startServer() ERROR: ${err.message}`);
    sendLog(`Server-Start fehlgeschlagen: ${err.message}`, "error");
    procs.server = null;
    status.server = { running: false, starting: false, managed: false };
    sendStatus();
  });

  procs.server.stdout?.on("data", (d) => {
    const line = d.toString().trim();
    if (line) {
      fileLog(`[Server stdout] ${line}`);
      sendLog(`[Server] ${line}`);
    }
  });

  procs.server.stderr?.on("data", (d) => {
    const line = d.toString().trim();
    if (line) {
      fileLog(`[Server stderr] ${line}`);
      sendLog(`[Server] ${line}`, "warn");
    }
  });

  procs.server.on("exit", (code) => {
    fileLog(`startServer() exited code=${code}`);
    procs.server = null;
    status.server = { running: false, starting: false, managed: false };
    sendStatus();
    sendLog(`Server beendet (Code: ${code})`, code === 0 ? "info" : "error");
  });

  status.server.managed = true;
}

function stopServer() {
  if (procs.server) {
    sendLog("Server wird gestoppt...", "info");
    try {
      execSync(`taskkill /T /F /PID ${procs.server.pid}`, { stdio: "ignore" });
    } catch {}
    procs.server = null;
  } else {
    killPort(8765);
    sendLog("Server-Prozess auf Port 8765 beendet.", "info");
  }
  status.server = { running: false, starting: false, managed: false };
  sendStatus();
}

function startDashboard() {
  if (status.dashboard.running || status.dashboard.starting) return;
  status.dashboard.starting = true;
  sendStatus();
  sendLog("Dashboard wird gestartet...", "info");
  fileLog(`startDashboard() cwd=${PATHS.dashboard}`);
  fileLog(`startDashboard() checking cwd exists: ${fs.existsSync(PATHS.dashboard)}`);
  try {
    const files = fs.readdirSync(PATHS.dashboard);
    fileLog(`startDashboard() directory contents: ${files.join(", ")}`);
  } catch (e) {
    fileLog(`startDashboard() cannot read dir: ${e.message}`);
  }

  procs.dashboard = spawn("cmd.exe", ["/c", "npm run start"], {
    cwd: PATHS.dashboard,
    stdio: ["ignore", "pipe", "pipe"],
  });

  fileLog(`startDashboard() spawned PID=${procs.dashboard.pid}`);

  procs.dashboard.on("error", (err) => {
    fileLog(`startDashboard() ERROR: ${err.message}`);
    sendLog(`Dashboard-Start fehlgeschlagen: ${err.message}`, "error");
    procs.dashboard = null;
    status.dashboard = { running: false, starting: false, managed: false };
    sendStatus();
  });

  procs.dashboard.stdout?.on("data", (d) => {
    const line = d.toString().trim();
    if (line) {
      fileLog(`[Dashboard stdout] ${line}`);
      sendLog(`[Dashboard] ${line}`);
    }
  });

  procs.dashboard.stderr?.on("data", (d) => {
    const line = d.toString().trim();
    if (line) {
      fileLog(`[Dashboard stderr] ${line}`);
      if (!line.includes("ExperimentalWarning")) {
        sendLog(`[Dashboard] ${line}`, "warn");
      }
    }
  });

  procs.dashboard.on("exit", (code) => {
    fileLog(`startDashboard() exited code=${code}`);
    procs.dashboard = null;
    status.dashboard = { running: false, starting: false, managed: false };
    sendStatus();
    sendLog(`Dashboard beendet (Code: ${code})`, code === 0 ? "info" : "error");
  });

  status.dashboard.managed = true;
}

function stopDashboard() {
  if (procs.dashboard) {
    sendLog("Dashboard wird gestoppt...", "info");
    try {
      execSync(`taskkill /T /F /PID ${procs.dashboard.pid}`, {
        stdio: "ignore",
      });
    } catch {}
    procs.dashboard = null;
  } else {
    killPort(3000);
    sendLog("Dashboard-Prozess auf Port 3000 beendet.", "info");
  }
  status.dashboard = { running: false, starting: false, managed: false };
  sendStatus();
}

function startClient() {
  if (status.client.running || status.client.starting) return;
  status.client.starting = true;
  sendStatus();
  sendLog("Client Agent wird gestartet...", "info");
  fileLog(`startClient() cwd=${PATHS.client}`);
  fileLog(`startClient() checking cwd exists: ${fs.existsSync(PATHS.client)}`);

  procs.client = spawn("cmd.exe", ["/c", "python agent.py"], {
    cwd: PATHS.client,
    stdio: ["ignore", "pipe", "pipe"],
  });

  fileLog(`startClient() spawned PID=${procs.client.pid}`);

  procs.client.on("error", (err) => {
    fileLog(`startClient() ERROR: ${err.message}`);
    sendLog(`Client-Start fehlgeschlagen: ${err.message}`, "error");
    procs.client = null;
    status.client = { running: false, starting: false, managed: false };
    sendStatus();
  });

  procs.client.stdout?.on("data", (d) => {
    const line = d.toString().trim();
    if (line) {
      fileLog(`[Client stdout] ${line}`);
      sendLog(`[Client] ${line}`);
    }
  });

  procs.client.stderr?.on("data", (d) => {
    const line = d.toString().trim();
    if (line) {
      fileLog(`[Client stderr] ${line}`);
      sendLog(`[Client] ${line}`, "warn");
    }
  });

  procs.client.on("exit", (code) => {
    fileLog(`startClient() exited code=${code}`);
    procs.client = null;
    status.client = { running: false, starting: false, managed: false };
    sendStatus();
    sendLog(`Client Agent beendet (Code: ${code})`, code === 0 ? "info" : "error");
  });

  status.client.managed = true;
  // Client doesn't have a port to poll – mark as running immediately
  setTimeout(() => {
    if (procs.client) {
      status.client.starting = false;
      status.client.running = true;
      sendStatus();
      sendLog("Client Agent läuft. Suche Server via Auto-Discovery...", "ok");
    }
  }, 2000);
}

function stopClient() {
  if (procs.client) {
    sendLog("Client Agent wird gestoppt...", "info");
    try {
      execSync(`taskkill /T /F /PID ${procs.client.pid}`, { stdio: "ignore" });
    } catch {}
    procs.client = null;
  }
  status.client = { running: false, starting: false, managed: false };
  sendStatus();
}

function stopAllProcesses() {
  if (procs.server) {
    try { execSync(`taskkill /T /F /PID ${procs.server.pid}`, { stdio: "ignore" }); } catch {}
    procs.server = null;
  }
  if (procs.dashboard) {
    try { execSync(`taskkill /T /F /PID ${procs.dashboard.pid}`, { stdio: "ignore" }); } catch {}
    procs.dashboard = null;
  }
  if (procs.client) {
    try { execSync(`taskkill /T /F /PID ${procs.client.pid}`, { stdio: "ignore" }); } catch {}
    procs.client = null;
  }
}

// ═════════════════════════════════════════════════════════════
//  Status Polling
// ═════════════════════════════════════════════════════════════
async function pollStatus() {
  const [serverUp, dashboardUp] = await Promise.all([
    checkPort(8765),
    checkPort(3000),
  ]);

  // Server
  if (serverUp && !status.server.running) {
    status.server = { running: true, starting: false, managed: status.server.managed };
    sendLog("Server ist online.", "ok");
  } else if (!serverUp && status.server.running && !status.server.starting) {
    status.server = { running: false, starting: false, managed: false };
  }
  if (serverUp) status.server.starting = false;
  status.server.running = serverUp;

  // Dashboard
  if (dashboardUp && !status.dashboard.running) {
    status.dashboard = { running: true, starting: false, managed: status.dashboard.managed };
    sendLog("Dashboard ist online.", "ok");
  } else if (!dashboardUp && status.dashboard.running && !status.dashboard.starting) {
    status.dashboard = { running: false, starting: false, managed: false };
  }
  if (dashboardUp) status.dashboard.starting = false;
  status.dashboard.running = dashboardUp;

  sendStatus();
}

// ═════════════════════════════════════════════════════════════
//  Launcher Window
// ═════════════════════════════════════════════════════════════
function createLauncherWindow() {
  const icon = createNeonIcon(32);
  launcherWindow = new BrowserWindow({
    width: 480,
    height: 600,
    frame: false,
    icon,
    resizable: false,
    backgroundColor: "#0a0a14",
    webPreferences: {
      preload: path.join(__dirname, "preload-launcher.js"),
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  launcherWindow.loadFile(path.join(__dirname, "launcher.html"));

  launcherWindow.webContents.once("did-finish-load", () => {
    launcherWindow.webContents.send("lan-ip", getLanIp());
    pollStatus(); // initial check
  });

  // Close → tray
  launcherWindow.on("close", (event) => {
    if (!isQuitting) {
      event.preventDefault();
      launcherWindow.hide();
      if (Notification.isSupported()) {
        new Notification({
          title: "SpecterMonitor",
          body: "App läuft im Hintergrund weiter.\nTray-Icon zum Öffnen klicken.",
          icon,
        }).show();
      }
    }
  });
}

// ═════════════════════════════════════════════════════════════
//  Dashboard Window (secondary, frameless)
// ═════════════════════════════════════════════════════════════
function openDashboardWindow() {
  if (dashboardWindow && !dashboardWindow.isDestroyed()) {
    dashboardWindow.show();
    dashboardWindow.focus();
    return;
  }

  dashboardWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 900,
    minHeight: 600,
    frame: false,
    icon: createNeonIcon(32),
    backgroundColor: "#0a0a14",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  dashboardWindow.loadURL(DASHBOARD_URL);

  dashboardWindow.on("maximize", () =>
    dashboardWindow.webContents.send("window-maximized", true)
  );
  dashboardWindow.on("unmaximize", () =>
    dashboardWindow.webContents.send("window-maximized", false)
  );

  dashboardWindow.on("closed", () => {
    dashboardWindow = null;
  });
}

// ═════════════════════════════════════════════════════════════
//  System Tray
// ═════════════════════════════════════════════════════════════
function createTray() {
  const icon = createNeonIcon(16);
  tray = new Tray(icon);
  tray.setToolTip("SpecterMonitor");

  const contextMenu = Menu.buildFromTemplate([
    {
      label: "Control Center öffnen",
      click: () => {
        launcherWindow?.show();
        launcherWindow?.focus();
      },
    },
    {
      label: "Dashboard öffnen",
      click: () => openDashboardWindow(),
    },
    { label: "Server-Status prüfen", click: () => checkServerStatus() },
    { type: "separator" },
    {
      label: "Beenden",
      click: () => {
        isQuitting = true;
        app.quit();
      },
    },
  ]);
  tray.setContextMenu(contextMenu);
  tray.on("double-click", () => {
    launcherWindow?.show();
    launcherWindow?.focus();
  });
}

function checkServerStatus() {
  const req = http.get(`${SERVER_URL}/api/snapshot`, (res) => {
    let body = "";
    res.on("data", (c) => (body += c));
    res.on("end", () => {
      new Notification({
        title: "SpecterMonitor – Server Status",
        body: `Server erreichbar (Port 8765) – HTTP ${res.statusCode}`,
      }).show();
    });
  });
  req.on("error", () => {
    new Notification({
      title: "SpecterMonitor – Server Status",
      body: "Server ist NICHT erreichbar.",
    }).show();
  });
  req.setTimeout(5000, () => {
    req.destroy();
    new Notification({
      title: "SpecterMonitor – Server Status",
      body: "Timeout – Server antwortet nicht.",
    }).show();
  });
}

// ═════════════════════════════════════════════════════════════
//  Update Handling (ZIP-based in-app updater)
// ═════════════════════════════════════════════════════════════

function extractZip(zipPath, destDir) {
  return new Promise((resolve, reject) => {
    try {
      // Ensure destination exists
      if (!fs.existsSync(destDir)) {
        fs.mkdirSync(destDir, { recursive: true });
      }
      // Use PowerShell Expand-Archive (available on all Windows 10/11)
      const psCmd = `Expand-Archive -Path "${zipPath}" -DestinationPath "${destDir}" -Force`;
      execSync(`powershell -NoProfile -Command "${psCmd}"`, {
        stdio: "pipe",
        timeout: 120000,
      });
      resolve(destDir);
    } catch (err) {
      reject(new Error(`ZIP-Entpacken fehlgeschlagen: ${err.message}`));
    }
  });
}

function getAppExePath() {
  // In packaged mode, app.getPath('exe') gives the .exe path
  // In dev mode, fall back to electron binary
  return app.isPackaged ? app.getPath("exe") : process.execPath;
}

function getAppInstallDir() {
  // The directory where the app .exe lives
  return path.dirname(getAppExePath());
}

function applyUpdateAndRestart(extractedDir) {
  return new Promise((resolve, reject) => {
    try {
      const appDir = getAppInstallDir();
      const appExe = getAppExePath();
      const tempDir = app.getPath("temp");
      const scriptPath = path.join(tempDir, "specter-update.cmd");

      // Find the actual content directory inside the extracted ZIP
      // The ZIP might contain a single root folder or direct files
      let sourceDir = extractedDir;
      const entries = fs.readdirSync(extractedDir);
      if (entries.length === 1) {
        const singleEntry = path.join(extractedDir, entries[0]);
        if (fs.statSync(singleEntry).isDirectory()) {
          // ZIP had a single root folder, use its contents
          sourceDir = singleEntry;
        }
      }

      fileLog(`applyUpdate: sourceDir=${sourceDir} appDir=${appDir} appExe=${appExe}`);

      // Generate a minimal update script
      const script = `@echo off
timeout /t 3 /nobreak >nul
xcopy /s /e /y "${sourceDir}\\*" "${appDir}\\"
start "" "${appExe}"
rd /s /q "${extractedDir}"
del "%~f0"
`;

      fs.writeFileSync(scriptPath, script, { encoding: "utf8" });
      fileLog(`Update script written to: ${scriptPath}`);

      // Launch the script detached
      const child = spawn("cmd.exe", ["/c", scriptPath], {
        detached: true,
        stdio: "ignore",
        windowsHide: true,
      });
      child.unref();

      resolve();
    } catch (err) {
      reject(new Error(`Update-Script Erstellung fehlgeschlagen: ${err.message}`));
    }
  });
}

function checkGitHubRelease() {
  return new Promise((resolve) => {
    const opts = {
      hostname: "api.github.com",
      path: `/repos/${GITHUB_OWNER}/${GITHUB_REPO}/releases/latest`,
      headers: { "User-Agent": "SpecterMonitor-Updater" },
    };
    https
      .get(opts, (res) => {
        let data = "";
        res.on("data", (c) => (data += c));
        res.on("end", () => {
          try {
            if (res.statusCode !== 200) return resolve(null);
            const rel = JSON.parse(data);
            const latest = (rel.tag_name || "").replace(/^v/, "");
            if (latest && latest !== APP_VERSION) {
              // Find a .zip asset in the release
              const zipAsset = (rel.assets || []).find((a) =>
                /\.zip$/i.test(a.name)
              );
              resolve({
                currentVersion: APP_VERSION,
                latestVersion: latest,
                releaseName: rel.name || `v${latest}`,
                releaseNotes: rel.body || "",
                releaseUrl: rel.html_url || "",
                downloadUrl: zipAsset
                  ? zipAsset.browser_download_url
                  : rel.zipball_url || null,
                fileName: zipAsset
                  ? zipAsset.name
                  : `SpecterMonitor-${latest}.zip`,
              });
            } else {
              resolve(null);
            }
          } catch {
            resolve(null);
          }
        });
      })
      .on("error", () => resolve(null));
  });
}

function sendUpdateToLauncher(info) {
  if (launcherWindow && !launcherWindow.isDestroyed()) {
    launcherWindow.webContents.send("update-info", info);
  }
}

function downloadRelease(url, destPath) {
  return new Promise((resolve, reject) => {
    const follow = (u) => {
      const mod = u.startsWith("https") ? https : http;
      mod.get(u, { headers: { "User-Agent": "SpecterMonitor-Updater" } }, (res) => {
        // Follow redirects (GitHub sends 302)
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          return follow(res.headers.location);
        }
        if (res.statusCode !== 200) {
          return reject(new Error(`HTTP ${res.statusCode}`));
        }

        const totalBytes = parseInt(res.headers["content-length"] || "0", 10);
        let downloaded = 0;
        let lastTime = Date.now();
        let lastBytes = 0;

        const file = fs.createWriteStream(destPath);
        res.on("data", (chunk) => {
          downloaded += chunk.length;
          file.write(chunk);

          const now = Date.now();
          const dt = (now - lastTime) / 1000;
          if (dt >= 0.5) {
            const speed = (downloaded - lastBytes) / dt;
            lastTime = now;
            lastBytes = downloaded;
            const percent = totalBytes > 0 ? Math.round((downloaded / totalBytes) * 100) : 0;
            if (launcherWindow && !launcherWindow.isDestroyed()) {
              launcherWindow.webContents.send("download-progress", {
                percent,
                transferred: downloaded,
                total: totalBytes,
                bytesPerSecond: Math.round(speed),
              });
            }
          }
        });
        res.on("end", () => {
          file.end(() => {
            // Send final 100%
            if (launcherWindow && !launcherWindow.isDestroyed()) {
              launcherWindow.webContents.send("download-progress", {
                percent: 100,
                transferred: downloaded,
                total: totalBytes,
                bytesPerSecond: 0,
              });
            }
            resolve(destPath);
          });
        });
        res.on("error", (err) => {
          file.close();
          try { fs.unlinkSync(destPath); } catch {}
          reject(err);
        });
      }).on("error", reject);
    };
    follow(url);
  });
}

// ═════════════════════════════════════════════════════════════
//  IPC Handlers
// ═════════════════════════════════════════════════════════════

// -- Window controls (from launcher or dashboard titlebar) --
ipcMain.on("window-minimize", (event) => {
  BrowserWindow.fromWebContents(event.sender)?.minimize();
});
ipcMain.on("window-maximize", (event) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  win?.isMaximized() ? win.unmaximize() : win?.maximize();
});
ipcMain.on("window-close", (event) => {
  BrowserWindow.fromWebContents(event.sender)?.close();
});

// -- Service controls --
ipcMain.on("start-server", () => startServer());
ipcMain.on("stop-server", () => stopServer());
ipcMain.on("start-dashboard", () => startDashboard());
ipcMain.on("stop-dashboard", () => stopDashboard());
ipcMain.on("start-client", () => startClient());
ipcMain.on("stop-client", () => stopClient());
ipcMain.on("start-all", () => {
  startServer();
  setTimeout(() => startDashboard(), 2000);
});
ipcMain.on("stop-all", () => {
  stopDashboard();
  stopClient();
  setTimeout(() => stopServer(), 500);
});
ipcMain.on("open-dashboard-window", () => openDashboardWindow());

// -- Update actions --
ipcMain.on("check-for-update", () => {
  checkGitHubRelease()
    .then((info) => {
      if (info) {
        autoUpdate(info);
      } else {
        if (launcherWindow && !launcherWindow.isDestroyed()) {
          launcherWindow.webContents.send("no-update");
        }
      }
    })
    .catch(() => {
      if (launcherWindow && !launcherWindow.isDestroyed()) {
        launcherWindow.webContents.send("no-update");
      }
    });
});
ipcMain.on("update-start-download", () => {
  if (!pendingUpdateInfo?.downloadUrl) {
    // No download URL at all – open the release page in browser
    if (pendingUpdateInfo?.releaseUrl) {
      shell.openExternal(pendingUpdateInfo.releaseUrl);
    }
    if (launcherWindow && !launcherWindow.isDestroyed()) {
      launcherWindow.webContents.send(
        "update-error",
        "Kein Update-Archiv gefunden. GitHub-Seite wird geöffnet."
      );
    }
    return;
  }

  const tempDir = app.getPath("temp");
  const destPath = path.join(tempDir, pendingUpdateInfo.fileName);
  sendLog(`Download gestartet: ${pendingUpdateInfo.fileName}`, "info");

  downloadRelease(pendingUpdateInfo.downloadUrl, destPath)
    .then((filePath) => {
      sendLog(`Download abgeschlossen: ${filePath}`, "ok");
      if (launcherWindow && !launcherWindow.isDestroyed()) {
        launcherWindow.webContents.send("update-downloaded", filePath);
      }

      // Extract and apply update
      sendLog("Update wird entpackt...", "info");
      if (launcherWindow && !launcherWindow.isDestroyed()) {
        launcherWindow.webContents.send("update-installing");
      }

      const extractDir = path.join(tempDir, "specter-update");
      // Clean up old extraction dir if exists
      try {
        if (fs.existsSync(extractDir)) {
          execSync(`rd /s /q "${extractDir}"`, { stdio: "ignore" });
        }
      } catch {}

      extractZip(filePath, extractDir)
        .then(() => {
          sendLog("Update entpackt – Neustart wird vorbereitet...", "ok");
          fileLog("ZIP extracted, preparing restart...");

          // Stop all services first
          stopAllProcesses();

          return applyUpdateAndRestart(extractDir);
        })
        .then(() => {
          sendLog("Update wird angewendet – App startet gleich neu...", "ok");
          // Clean up the downloaded ZIP
          try { fs.unlinkSync(filePath); } catch {}

          setTimeout(() => {
            isQuitting = true;
            app.quit();
          }, 1500);
        })
        .catch((err) => {
          sendLog(`Update fehlgeschlagen: ${err.message}`, "error");
          fileLog(`Update extraction/apply error: ${err.message}`);
          if (launcherWindow && !launcherWindow.isDestroyed()) {
            launcherWindow.webContents.send("update-error", `Update fehlgeschlagen: ${err.message}`);
          }
        });
    })
    .catch((err) => {
      sendLog(`Download fehlgeschlagen: ${err.message}`, "error");
      if (launcherWindow && !launcherWindow.isDestroyed()) {
        launcherWindow.webContents.send("update-error", `Download fehlgeschlagen: ${err.message}`);
      }
    });
});
ipcMain.on("update-install-now", (_e, filePath) => {
  if (filePath && fs.existsSync(filePath)) {
    sendLog("Update wird entpackt und angewendet...", "info");
    const tempDir = app.getPath("temp");
    const extractDir = path.join(tempDir, "specter-update");

    try {
      if (fs.existsSync(extractDir)) {
        execSync(`rd /s /q "${extractDir}"`, { stdio: "ignore" });
      }
    } catch {}

    extractZip(filePath, extractDir)
      .then(() => {
        stopAllProcesses();
        return applyUpdateAndRestart(extractDir);
      })
      .then(() => {
        try { fs.unlinkSync(filePath); } catch {}
        setTimeout(() => {
          isQuitting = true;
          app.quit();
        }, 1500);
      })
      .catch((err) => {
        sendLog(`Update fehlgeschlagen: ${err.message}`, "error");
        if (launcherWindow && !launcherWindow.isDestroyed()) {
          launcherWindow.webContents.send("update-error", `Update fehlgeschlagen: ${err.message}`);
        }
      });
  }
});
ipcMain.on("update-open-folder", (_e, filePath) => {
  if (filePath) shell.showItemInFolder(filePath);
});
ipcMain.on("update-open-release", (_e, url) => {
  if (url) shell.openExternal(url);
});

// ═════════════════════════════════════════════════════════════
//  Auto-Update: download ZIP + extract + restart
// ═════════════════════════════════════════════════════════════
function autoUpdate(info) {
  pendingUpdateInfo = info;
  sendLog(`Update verfügbar: v${info.latestVersion} – Auto-Update startet...`, "info");

  // Notify launcher UI
  setTimeout(() => {
    sendUpdateToLauncher(info);
    if (launcherWindow && !launcherWindow.isDestroyed()) {
      launcherWindow.webContents.send("auto-update-started");
    }
  }, 1500);

  if (!info.downloadUrl) {
    sendLog("Kein Update-Archiv gefunden – Update übersprungen.", "warn");
    return;
  }

  const tempDir = app.getPath("temp");
  const destPath = path.join(tempDir, info.fileName);
  sendLog(`Download gestartet: ${info.fileName}`, "info");

  // Start download automatically
  setTimeout(() => {
    downloadRelease(info.downloadUrl, destPath)
      .then((filePath) => {
        sendLog("Download abgeschlossen – Update wird entpackt...", "ok");
        if (launcherWindow && !launcherWindow.isDestroyed()) {
          launcherWindow.webContents.send("update-downloaded", filePath);
          launcherWindow.webContents.send("auto-update-installing");
        }

        const extractDir = path.join(tempDir, "specter-update");
        // Clean up old extraction dir
        try {
          if (fs.existsSync(extractDir)) {
            execSync(`rd /s /q "${extractDir}"`, { stdio: "ignore" });
          }
        } catch {}

        return extractZip(filePath, extractDir).then(() => {
          fileLog("ZIP extracted successfully for auto-update");
          sendLog("Update entpackt – Neustart wird vorbereitet...", "ok");

          // Stop all services
          stopAllProcesses();

          return applyUpdateAndRestart(extractDir).then(() => {
            // Clean up ZIP
            try { fs.unlinkSync(filePath); } catch {}
            sendLog("Update wird angewendet – App startet gleich neu...", "ok");

            setTimeout(() => {
              isQuitting = true;
              app.quit();
            }, 1500);
          });
        });
      })
      .catch((err) => {
        sendLog(`Auto-Update fehlgeschlagen: ${err.message}`, "error");
        fileLog(`Auto-update error: ${err.message}`);
        if (launcherWindow && !launcherWindow.isDestroyed()) {
          launcherWindow.webContents.send("update-error", `Update fehlgeschlagen: ${err.message}`);
        }
      });
  }, 2000);
}

// ═════════════════════════════════════════════════════════════
//  App Lifecycle
// ═════════════════════════════════════════════════════════════
app.on("ready", () => {
  Menu.setApplicationMenu(null);
  createLauncherWindow();
  createTray();

  // Start polling service status every 3s
  statusInterval = setInterval(pollStatus, 3000);
  pollStatus();

  // Check for updates and auto-install if available
  checkGitHubRelease()
    .then((info) => {
      if (info) {
        autoUpdate(info);
      }
    })
    .catch(() => {});
});

app.on("window-all-closed", () => {
  // Stay alive in tray
});

app.on("before-quit", () => {
  isQuitting = true;
  if (statusInterval) clearInterval(statusInterval);
  stopAllProcesses();
});

app.on("activate", () => {
  launcherWindow?.show();
});
