// ═══════════════════════════════════════════════════════════════
//  Preload: Dashboard Window
//  Exposes window controls to the renderer.
// ═══════════════════════════════════════════════════════════════

const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
  isElectron: true,
  minimize: () => ipcRenderer.send("window-minimize"),
  maximize: () => ipcRenderer.send("window-maximize"),
  close: () => ipcRenderer.send("window-close"),
  onMaximizedChange: (cb) =>
    ipcRenderer.on("window-maximized", (_e, val) => cb(val)),
});
