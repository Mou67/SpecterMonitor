// ═══════════════════════════════════════════════════════════════
//  Preload: Update Window
//  Exposes update-related IPC to the update popup.
// ═══════════════════════════════════════════════════════════════

const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("updateAPI", {
  // Receive data from main process
  onUpdateInfo: (cb) =>
    ipcRenderer.on("update-info", (_e, info) => cb(info)),
  onDownloadProgress: (cb) =>
    ipcRenderer.on("download-progress", (_e, progress) => cb(progress)),
  onUpdateDownloaded: (cb) =>
    ipcRenderer.on("update-downloaded", () => cb()),
  onUpdateError: (cb) =>
    ipcRenderer.on("update-error", (_e, msg) => cb(msg)),

  // Send actions to main process
  startDownload: () => ipcRenderer.send("update-start-download"),
  installNow: () => ipcRenderer.send("update-install-now"),
  dismiss: () => ipcRenderer.send("update-dismiss"),
  openRelease: (url) => ipcRenderer.send("update-open-release", url),
});
