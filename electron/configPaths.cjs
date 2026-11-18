const fs = require("fs");
const path = require("path");

function canUseDir(dirPath) {
  try {
    fs.mkdirSync(dirPath, { recursive: true });
    fs.accessSync(dirPath, fs.constants.W_OK);
    return true;
  } catch {
    return false;
  }
}

function getBaseConfigDir() {
  const override = String(process.env.GUI_HUL_CONFIG_DIR || "").trim();
  if (override) return path.resolve(override);

  // Preferred: a stable, easy-to-find folder on C:\
  // Falls back if the machine blocks writing to C:\ for non-admin users.
  if (process.platform === "win32") {
    const candidates = [
      "C:\\Users\\Public\\Documents\\GUI_HUL\\configs",
      "C:\\ProgramData\\GUI_HUL\\configs",
      "C:\\GUI_HUL\\configs"
    ];
    for (const preferred of candidates) {
      if (canUseDir(preferred)) return preferred;
    }
  }

  // Default: user-writable directory on C: for Windows 10/11.
  // Example: C:\Users\<user>\AppData\Local\GUI_HUL\configs
  const base =
    (process.env.LOCALAPPDATA && process.env.LOCALAPPDATA.trim()) ||
    (process.env.APPDATA && process.env.APPDATA.trim()) ||
    (process.env.USERPROFILE && process.env.USERPROFILE.trim()) ||
    "C:\\Users\\Public";

  return path.join(base, "GUI_HUL", "configs");
}

function getConfigPath(fileName) {
  return path.join(getBaseConfigDir(), fileName);
}

module.exports = { getBaseConfigDir, getConfigPath };
