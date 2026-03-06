const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("launcherAPI", {
  // Window controls
  minimize: () => ipcRenderer.send("window-minimize"),
  close: () => ipcRenderer.send("window-close"),

  // Service controls
  startServer: () => ipcRenderer.send("start-server"),
  stopServer: () => ipcRenderer.send("stop-server"),
  startDashboard: () => ipcRenderer.send("start-dashboard"),
  stopDashboard: () => ipcRenderer.send("stop-dashboard"),
  startClient: () => ipcRenderer.send("start-client"),
  stopClient: () => ipcRenderer.send("stop-client"),
  startAll: () => ipcRenderer.send("start-all"),
  stopAll: () => ipcRenderer.send("stop-all"),
  openDashboard: () => ipcRenderer.send("open-dashboard-window"),

  // Update controls
  checkForUpdate: () => ipcRenderer.send("check-for-update"),
  startDownload: () => ipcRenderer.send("update-start-download"),
  installNow: (filePath) => ipcRenderer.send("update-install-now", filePath),
  openFolder: (filePath) => ipcRenderer.send("update-open-folder", filePath),
  openRelease: (url) => ipcRenderer.send("update-open-release", url),

  // Listeners
  onStatusUpdate: (cb) =>
    ipcRenderer.on("status-update", (_e, s) => cb(s)),
  onLog: (cb) =>
    ipcRenderer.on("log", (_e, msg, type) => cb(msg, type)),
  onLanIp: (cb) =>
    ipcRenderer.on("lan-ip", (_e, ip) => cb(ip)),

  // Update listeners
  onUpdateInfo: (cb) =>
    ipcRenderer.on("update-info", (_e, info) => cb(info)),
  onNoUpdate: (cb) =>
    ipcRenderer.on("no-update", () => cb()),
  onDownloadProgress: (cb) =>
    ipcRenderer.on("download-progress", (_e, p) => cb(p)),
  onUpdateDownloaded: (cb) =>
    ipcRenderer.on("update-downloaded", (_e, filePath) => cb(filePath)),
  onUpdateError: (cb) =>
    ipcRenderer.on("update-error", (_e, msg) => cb(msg)),
  onUpdateInstalling: (cb) =>
    ipcRenderer.on("update-installing", () => cb()),
  onAutoUpdateStarted: (cb) =>
    ipcRenderer.on("auto-update-started", () => cb()),
  onAutoUpdateInstalling: (cb) =>
    ipcRenderer.on("auto-update-installing", () => cb()),

  // Setup
  checkDeps: () => ipcRenderer.invoke("check-deps"),
  runSetup: () => ipcRenderer.send("run-setup"),
  setupFirewall: () => ipcRenderer.send("setup-firewall"),
  onSetupLog: (cb) => ipcRenderer.on("setup-log", (_e, msg, type) => cb(msg, type)),
  onSetupStep: (cb) => ipcRenderer.on("setup-step", (_e, step, status) => cb(step, status)),
  onSetupStarted: (cb) => ipcRenderer.on("setup-started", () => cb()),
  onSetupDone: (cb) => ipcRenderer.on("setup-done", (_e, success) => cb(success)),
  onFirewallDone: (cb) => ipcRenderer.on("firewall-done", () => cb()),
});
