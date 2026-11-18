const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("api", {
  getConfig: () => ipcRenderer.invoke("config:get"),
  setConfig: (cfg, role) => ipcRenderer.invoke("config:set", { cfg, role }),
  runPython: (payload) => ipcRenderer.invoke("run:python", payload)
});
