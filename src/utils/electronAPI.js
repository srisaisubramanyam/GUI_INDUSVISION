export function getElectron() {
  if (!window.api) {
    throw new Error("Electron preload API not found. Run with npm run dev (electron).")
  }

  const role = localStorage.getItem("role") || "client";
  return { api: window.api, role };
}

export async function useElectronAPI() {
  const { api, role } = getElectron();

  return {
    getConfig: () => api.getConfig(),
    setConfig: (cfg) => api.setConfig(cfg, role),
    getCameraConfig: () => api.getCameraConfig(),
    setCameraConfig: (cfg) => api.setCameraConfig(cfg, role),
    getDiagnosisConfig: () => api.getDiagnosisConfig(),
    setDiagnosisConfig: (cfg) => api.setDiagnosisConfig(cfg, role),
    getDiagnosisMappings: () => api.getDiagnosisMappings(),
    setDiagnosisMappings: (cfg) => api.setDiagnosisMappings(cfg, role),
    selectDirectory: (payload) => api.selectDirectory(payload),
    listDiagnosisImages: (payload) => api.listDiagnosisImages(payload),
    runPython: (payload) => api.runPython(payload),
    stopPython: (payload) => api.stopPython(payload),
    getRunState: () => api.getRunState(),
    getPlcStatus: (payload) => api.getPlcStatus(payload),
    setSingleDefectReject: (payload) => api.setSingleDefectReject(payload),
    onRunState: (cb) => api.onRunState(cb)
  };
}
