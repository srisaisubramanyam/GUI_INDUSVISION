const { app, BrowserWindow, ipcMain } = require("electron");
const fs = require("fs");
const path = require("path");
const { spawn, spawnSync } = require("child_process");
const { readConfig, writeConfig } = require("./configStore.cjs");

let mainWindow;

function stripWrappingQuotes(value) {
  const v = String(value ?? "").trim();
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
    return v.slice(1, -1).trim();
  }
  return v;
}

function quoteForCmdToken(token) {
  const t = stripWrappingQuotes(token);
  return /\s/.test(t) ? `"${t}"` : t;
}

function resolvePythonLauncher(configuredPythonExe) {
  if (configuredPythonExe.toLowerCase() !== "python") {
    return configuredPythonExe;
  }

  const check = spawnSync("where", ["python"], { windowsHide: true, shell: false });
  if (check.status === 0) {
    return "python";
  }
  return "py";
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 820,
    backgroundColor: "#0b1220",
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  if (!app.isPackaged) {
    mainWindow.loadURL("http://localhost:5173");
  } else {
    mainWindow.loadFile(path.join(__dirname, "../dist/index.html"));
  }
}

app.whenReady().then(() => {
  createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

/** Config read for everyone */
ipcMain.handle("config:get", () => {
  return readConfig();
});

/** Config write only for developer */
ipcMain.handle("config:set", (_evt, { cfg, role }) => {
  if (role !== "developer") {
    throw new Error("Permission denied: only developer can modify config.");
  }
  writeConfig(cfg);
  return { ok: true };
});

/** Run python minimized cmd */
ipcMain.handle("run:python", async (_evt, { scriptPath, args = [] }) => {
  if (!scriptPath) throw new Error("Missing scriptPath");
  const cleanScriptPath = stripWrappingQuotes(scriptPath);
  const normalizedScriptPath = path.normalize(cleanScriptPath);
  if (!fs.existsSync(normalizedScriptPath)) {
    throw new Error(`Script file not found: ${cleanScriptPath}`);
  }

  const cfg = readConfig();
  const configuredPythonExe = (cfg && cfg.python && cfg.python.exe)
    ? stripWrappingQuotes(cfg.python.exe)
    : "python";
  const pythonLauncher = resolvePythonLauncher(configuredPythonExe);

  const cmdArgs = [
    quoteForCmdToken(pythonLauncher),
    quoteForCmdToken(normalizedScriptPath),
    ...(args || []).map((a) => quoteForCmdToken(stripWrappingQuotes(a)))
  ];
  const commandToRun = cmdArgs.join(" ");

  // Windows: start "" /min cmd.exe /k "python script.py"
  const child = spawn("cmd.exe", [], {
    windowsHide: false,
    detached: true,
    stdio: ["pipe", "ignore", "ignore"]
  });

  child.stdin.write(`${commandToRun}\r\n`);
  child.stdin.end();
  child.unref();
  return { ok: true };
});
