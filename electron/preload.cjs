const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("api", {
  getConfig: () => ipcRenderer.invoke("config:get"),
  setConfig: (cfg, role) => ipcRenderer.invoke("config:set", { cfg, role }),
  getCameraConfig: () => ipcRenderer.invoke("camera-config:get"),
  setCameraConfig: (cfg, role) => ipcRenderer.invoke("camera-config:set", { cfg, role }),
  getDiagnosisConfig: () => ipcRenderer.invoke("diagnosis-config:get"),
  setDiagnosisConfig: (cfg, role) => ipcRenderer.invoke("diagnosis-config:set", { cfg, role }),
  getDiagnosisMappings: () => ipcRenderer.invoke("diagnosis-mappings:get"),
  setDiagnosisMappings: (cfg, role) => ipcRenderer.invoke("diagnosis-mappings:set", { cfg, role }),
  selectDirectory: (payload) => ipcRenderer.invoke("dialog:select-directory", payload),
  listDiagnosisImages: (payload) => ipcRenderer.invoke("diagnosis:images:list", payload),
  runPython: (payload) => ipcRenderer.invoke("run:python", payload),
  stopPython: (payload) => ipcRenderer.invoke("run:stop", payload),
  getRunState: () => ipcRenderer.invoke("run:get-state"),
  getPlcStatus: (payload) => ipcRenderer.invoke("plc:status", payload),
  setSingleDefectReject: (payload) => ipcRenderer.invoke("plc:set-single-defect", payload),
  onRunState: (cb) => {
    const handler = (_event, payload) => cb(payload);
    ipcRenderer.on("run:state", handler);
    return () => ipcRenderer.removeListener("run:state", handler);
  }
});
