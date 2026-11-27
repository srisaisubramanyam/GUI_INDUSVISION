const { app, BrowserWindow, ipcMain, dialog } = require("electron");
const fs = require("fs");
const path = require("path");
const net = require("net");
const { spawn, spawnSync } = require("child_process");
const { readConfig, writeConfig } = require("./configStore.cjs");
const { updateOcrConfig } = require("./ocrConfigWriter.cjs");
const { readCameraConfig, writeCameraConfig } = require("./cameraConfigStore.cjs");
const { readDiagnosisConfig, writeDiagnosisConfig } = require("./diagnosisConfigStore.cjs");
const { readDiagnosisMappings, writeDiagnosisMappings } = require("./diagnosisMappingsStore.cjs");
const { readRunState, setLineRunState, clearLineRunState } = require("./runStateStore.cjs");

let mainWindow;
// Set while the app / Windows session is shutting down, so terminals killed by
// the shutdown are not mistaken for a user stop (their run state must survive).
let isShuttingDown = false;
let restoreRunStatePromise = Promise.resolve();
const runningLineProcesses = new Map();
const runningLineSkuLabels = new Map();
const runningLinePollers = new Map();
const lineCooldownDeadlines = new Map();
const lineCooldownTimeouts = new Map();
const STOP_COOLDOWN_MS = 20 * 1000;

// ---- PLC bridge -----------------------------------------------------------
// The running SKU script (OCR child process) listens on 127.0.0.1:<port>.
// Each request is one line, each reply one line of JSON:
//   STATUS            -> {"plc": "ready"|"disabled"|"not_connected",
//                         "single_defect": bool, "consecutive": n, "default": n}
//   SINGLE_DEFECT ON  -> {"ok": true, "single_defect": true,  "consecutive": 1}
//   SINGLE_DEFECT OFF -> {"ok": true, "single_defect": false, "consecutive": <default>}
//   (failures)        -> {"ok": false, "error": "<message>"}
// The port is handed to the script via the PLC_BRIDGE_PORT env var at launch.
const PLC_BRIDGE_BASE_PORT = 5000;
const PLC_STATUS_TIMEOUT_MS = 2000;
const PLC_SET_TIMEOUT_MS = 5000;
const plcBusyLines = new Set();
const PLC_STATE_BY_BRIDGE = { ready: "ready", disabled: "disabled", not_connected: "offline" };

function parseBridgeReply(reply) {
  try {
    const data = JSON.parse(reply);
    return data && typeof data === "object" ? data : null;
  } catch {
    return null;
  }
}

// Port per line: code.lineSettings.<line>.plcPort if set, else 5000 + the line's number
// (Line14 -> 5014).
function getPlcPort(lineKey) {
  try {
    const override = Number(readConfig()?.code?.lineSettings?.[lineKey]?.plcPort);
    if (Number.isInteger(override) && override > 0 && override < 65536) return override;
  } catch {
    // fall back to the derived port
  }
  const digits = String(lineKey || "").match(/\d+/);
  const lineNumber = digits ? Number(digits[0]) % 1000 : 0;
  return PLC_BRIDGE_BASE_PORT + lineNumber;
}

// Sends one command to the bridge and resolves with its one-line reply.
// Never rejects: connection/timeout problems come back as { ok: false, code }.
function sendPlcBridgeCommand(port, command, timeoutMs) {
  return new Promise((resolve) => {
    let reply = "";
    let settled = false;
    const finish = (result) => {
      if (settled) return;
      settled = true;
      socket.destroy();
      resolve(result);
    };

    const socket = net.createConnection({ host: "127.0.0.1", port });
    socket.setTimeout(timeoutMs);
    socket.on("connect", () => socket.write(`${command}\n`));
    socket.on("data", (buf) => {
      reply += String(buf);
      if (reply.includes("\n")) finish({ ok: true, reply: reply.trim() });
    });
    socket.on("end", () => finish(reply ? { ok: true, reply: reply.trim() } : { ok: false, code: "EMPTY" }));
    socket.on("timeout", () => finish({ ok: false, code: "TIMEOUT" }));
    socket.on("error", (err) => finish({ ok: false, code: err?.code || "ERROR", message: err?.message }));
  });
}

// Bridge unreachable: the line is either stopped, or its script is still starting
// (the bridge only opens after the camera and PLC workers are up).
function unreachablePlcResult(lineKey, res) {
  if (res.code === "TIMEOUT") {
    return { ok: false, state: "timeout", message: `No reply from ${lineKey} PLC bridge (timeout).` };
  }
  if (runningLineProcesses.get(lineKey)) {
    return { ok: false, state: "starting", message: `${lineKey} is still starting. Try again in a few seconds.` };
  }
  return { ok: false, state: "not_running", message: `No SKU is running on ${lineKey}.` };
}

function broadcastRunState(payload) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send("run:state", payload);
  }
}

function stripWrappingQuotes(value) {
  const v = String(value ?? "").trim();
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
    return v.slice(1, -1).trim();
  }
  return v;
}

// The script path field may also carry arguments, e.g.
// `E:/dir/machine_runner.py cluster2_Machine6_Sunsilk` or `"E:/my dir/run.py" arg`.
// Split it into the script file and its extra args.
function splitScriptPathAndArgs(rawScriptPath) {
  const raw = String(rawScriptPath ?? "").trim();
  const whole = stripWrappingQuotes(raw);
  if (fs.existsSync(path.normalize(whole))) {
    return { scriptPath: whole, extraArgs: [] };
  }

  const tokenize = (s) => (s.match(/"[^"]*"|'[^']*'|\S+/g) || []).map(stripWrappingQuotes);

  const quoted = raw.match(/^(["'])(.*?)\1\s*(.*)$/);
  if (quoted) {
    return { scriptPath: quoted[2].trim(), extraArgs: tokenize(quoted[3]) };
  }

  const scriptMatch = raw.match(/^(.*?\.(?:py|bat|cmd))(?:\s+(.*))?$/i);
  if (scriptMatch) {
    return { scriptPath: scriptMatch[1].trim(), extraArgs: tokenize(scriptMatch[2] || "") };
  }

  return { scriptPath: whole, extraArgs: [] };
}

function quoteForCmdToken(token) {
  const t = stripWrappingQuotes(token);
  const escaped = t.replace(/"/g, '\\"');
  return /[\s&()^=;!'+,`~[\]{}]/.test(escaped) ? `"${escaped}"` : escaped;
}

function escapeForPowerShellSingle(value) {
  return String(value ?? "").replace(/'/g, "''");
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

function getScriptExtension(scriptPath) {
  return path.extname(String(scriptPath || "")).toLowerCase();
}

function buildScriptCommand({ normalizedScriptPath, args, pythonLauncher }) {
  const extension = getScriptExtension(normalizedScriptPath);
  const cleanArgs = (args || []).map((a) => quoteForCmdToken(stripWrappingQuotes(a)));

  if (extension === ".py") {
    return {
      ok: true,
      command: [
        quoteForCmdToken(pythonLauncher),
        quoteForCmdToken(normalizedScriptPath),
        ...cleanArgs
      ].join(" ")
    };
  }

  if (extension === ".bat" || extension === ".cmd") {
    return {
      ok: true,
      command: [
        quoteForCmdToken(normalizedScriptPath),
        ...cleanArgs
      ].join(" ")
    };
  }

  return {
    ok: false,
    message: "Unsupported script type. Please choose a .py, .bat, or .cmd file."
  };
}

function applyClientToggleUpdate(currentCfg, nextCfg) {
  const requestedDefectItems = nextCfg?.defectToggles?.items || [];
  const mergedDefectItems = requestedDefectItems
    .filter((item) => item && typeof item === "object")
    .map((item, idx) => ({
      id: item.id || `def_${Date.now()}_${idx}`,
      name: item.name ?? item.label ?? `Toggle ${idx + 1}`,
      enabled: Boolean(item.enabled)
    }));

  const requestedDataCollectionItems = nextCfg?.dataCollection?.items || [];
  const mergedDataCollectionItems = requestedDataCollectionItems
    .filter((item) => item && typeof item === "object")
    .map((item, idx) => ({
      id: item.id || `dc_${Date.now()}_${idx}`,
      name: item.name ?? item.label ?? `Data Toggle ${idx + 1}`,
      enabled: Boolean(item.enabled)
    }));

  return {
    ...currentCfg,
    defectToggles: {
      ...(currentCfg?.defectToggles || {}),
      items: mergedDefectItems
    },
    dataCollection: {
      ...(currentCfg?.dataCollection || {}),
      items: mergedDataCollectionItems
    }
  };
}

function getLineProcessKey(lineName) {
  return String(lineName || "__global__");
}

function getRemainingCooldownMs(lineKey) {
  const deadline = lineCooldownDeadlines.get(lineKey);
  if (!deadline) return 0;
  return Math.max(0, deadline - Date.now());
}

function clearLineCooldownTimeout(lineKey) {
  const timer = lineCooldownTimeouts.get(lineKey);
  if (timer) {
    clearTimeout(timer);
    lineCooldownTimeouts.delete(lineKey);
  }
}

function clearExpiredCooldown(lineKey) {
  const remainingMs = getRemainingCooldownMs(lineKey);
  if (remainingMs > 0) return false;
  clearLineCooldownTimeout(lineKey);
  if (lineCooldownDeadlines.has(lineKey)) {
    lineCooldownDeadlines.delete(lineKey);
    broadcastRunState({
      lineName: lineKey,
      running: false,
      cooldownActive: false,
      cooldownMsRemaining: 0
    });
  }
  return true;
}

function startLineCooldown(lineKey, skuLabel, reason) {
  const cooldownUntil = Date.now() + STOP_COOLDOWN_MS;
  lineCooldownDeadlines.set(lineKey, cooldownUntil);
  clearLineCooldownTimeout(lineKey);
  const timer = setTimeout(() => {
    clearExpiredCooldown(lineKey);
  }, STOP_COOLDOWN_MS + 250);
  lineCooldownTimeouts.set(lineKey, timer);

  broadcastRunState({
    lineName: lineKey,
    running: false,
    reason,
    skuLabel: String(skuLabel || ""),
    cooldownActive: true,
    cooldownUntil,
    cooldownMsRemaining: STOP_COOLDOWN_MS
  });
}

function getRunStateSnapshot() {
  const running = {};
  for (const [lineKey, pid] of runningLineProcesses.entries()) {
    if (pid) {
      running[lineKey] = {
        running: true,
        skuLabel: runningLineSkuLabels.get(lineKey) || ""
      };
    }
  }

  const cooldowns = {};
  for (const [lineKey] of lineCooldownDeadlines.entries()) {
    const remainingMs = getRemainingCooldownMs(lineKey);
    if (remainingMs <= 0) {
      clearExpiredCooldown(lineKey);
      continue;
    }
    cooldowns[lineKey] = {
      cooldownActive: true,
      cooldownUntil: Date.now() + remainingMs,
      cooldownMsRemaining: remainingMs
    };
  }

  return { running, cooldowns, stopCooldownMs: STOP_COOLDOWN_MS };
}

function getActiveCloseBlockRemainingMs() {
  let maxRemainingMs = 0;
  for (const [lineKey] of lineCooldownDeadlines.entries()) {
    const remainingMs = getRemainingCooldownMs(lineKey);
    if (remainingMs <= 0) {
      clearExpiredCooldown(lineKey);
      continue;
    }
    if (remainingMs > maxRemainingMs) {
      maxRemainingMs = remainingMs;
    }
  }
  return maxRemainingMs;
}

function clearLinePoller(lineKey) {
  const timer = runningLinePollers.get(lineKey);
  if (timer) {
    clearInterval(timer);
    runningLinePollers.delete(lineKey);
  }
}

// Returns "running", "stopped" or "unknown" (tasklist itself failed).
// Used by the pollers so a failed check never counts as the terminal closing.
function getPidStatus(pid) {
  if (!pid) return "stopped";
  const result = spawnSync("tasklist", ["/FI", `PID eq ${pid}`, "/FO", "CSV", "/NH"], {
    windowsHide: true,
    shell: false
  });
  if (result.error || result.status !== 0) return "unknown";
  const out = String(result.stdout || "");
  return out.includes(`"${pid}"`) ? "running" : "stopped";
}

// True only if the PID is alive and is still a cmd.exe terminal (guards against PID reuse).
function isTrackedTerminalAlive(pid) {
  if (!pid) return false;
  const result = spawnSync("tasklist", ["/FI", `PID eq ${pid}`, "/FO", "CSV", "/NH"], {
    windowsHide: true,
    shell: false
  });
  if (result.error || result.status !== 0) return false;
  const out = String(result.stdout || "").toLowerCase();
  return out.includes(`"${pid}"`) && out.includes("\"cmd.exe\"");
}

function stopProcessTree(pid) {
  if (!pid) return false;
  const killResult = spawnSync("taskkill", ["/PID", String(pid), "/T", "/F"], {
    windowsHide: true,
    shell: false
  });
  return killResult.status === 0;
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

  mainWindow.loadFile(path.join(__dirname, "../dist/index.html"));
  mainWindow.on("close", (event) => {
    const remainingMs = getActiveCloseBlockRemainingMs();
    if (remainingMs <= 0) return;

    event.preventDefault();
    broadcastRunState({
      type: "close-blocked",
      running: false,
      cooldownActive: true,
      cooldownMsRemaining: remainingMs
    });
  });

  // Windows shutdown / restart / log off: keep the saved run state so lines resume on next start.
  // query-session-end fires first, before Windows starts killing the terminals.
  mainWindow.on("query-session-end", markShuttingDown);
  mainWindow.on("session-end", markShuttingDown);
}

function markShuttingDown() {
  isShuttingDown = true;
  for (const lineKey of [...runningLinePollers.keys()]) {
    clearLinePoller(lineKey);
  }
}

function ensureRequiredConfigFiles() {
  try { readConfig(); } catch (e) { console.error("Failed to init defect_toggle.json:", e); }
  try { readCameraConfig(); } catch (e) { console.error("Failed to init cameraconfig.json:", e); }
  try { readDiagnosisConfig(); } catch (e) { console.error("Failed to init diagnosis.json:", e); }
}

// Only one app instance may run, otherwise each instance would resume the saved
// lines on start and the same script would be launched twice.
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (!mainWindow || mainWindow.isDestroyed()) return;
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  });
}

app.whenReady().then(() => {
  if (!app.hasSingleInstanceLock()) return;
  ensureRequiredConfigFiles();
  restoreRunStatePromise = restoreRunningLines().catch((e) => {
    console.error("Failed to restore running lines:", e);
  });
  createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("before-quit", () => {
  markShuttingDown();
  for (const [lineKey, pid] of runningLineProcesses.entries()) {
    if (pid && isTrackedTerminalAlive(pid)) {
      stopProcessTree(pid);   // taskkill /T /F closes cmd.exe and python.exe
    }
  }
  runningLineProcesses.clear();
  runningLineSkuLabels.clear();
});


app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

ipcMain.handle("config:get", () => {
  return readConfig();
});

ipcMain.handle("config:set", (_evt, { cfg, role }) => {
  if (role === "developer") {
    writeConfig(cfg);
    return { ok: true };
  }

  if (role === "client") {
    const currentCfg = readConfig();
    const nextCfg = applyClientToggleUpdate(currentCfg, cfg);
    writeConfig(nextCfg);
    return { ok: true };
  }

  throw new Error("Permission denied: unknown role.");
});

ipcMain.handle("dialog:select-directory", async (_evt, { defaultPath } = {}) => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: "Select Output Directory",
    defaultPath: String(defaultPath || "").trim() || undefined,
    properties: ["openDirectory", "createDirectory"]
  });

  return {
    canceled: result.canceled,
    filePath: result.canceled ? "" : (result.filePaths?.[0] || "")
  };
});

// Starts tracking a line's terminal: in-memory maps, UI broadcast and exit poller.
function trackLineProcess(lineKey, pid, skuLabel) {
  runningLineProcesses.set(lineKey, pid);
  runningLineSkuLabels.set(lineKey, String(skuLabel || ""));
  broadcastRunState({ lineName: lineKey, running: true, skuLabel: String(skuLabel || "") });

  clearLinePoller(lineKey);
  const timer = setInterval(() => {
    if (isShuttingDown) {
      clearLinePoller(lineKey);
      return;
    }

    const trackedPid = runningLineProcesses.get(lineKey);
    if (trackedPid !== pid) {
      clearLinePoller(lineKey);
      return;
    }

    if (getPidStatus(pid) !== "stopped") return;

    // Terminal was closed by the user: treat as stopped, so it stays off on next start.
    runningLineProcesses.delete(lineKey);
    const activeSkuLabel = runningLineSkuLabels.get(lineKey) || "";
    runningLineSkuLabels.delete(lineKey);
    clearLinePoller(lineKey);
    clearLineRunState(lineKey);
    startLineCooldown(lineKey, activeSkuLabel, "exited");
  }, 1500);
  runningLinePollers.set(lineKey, timer);
}

// On app start: re-attach to terminals that are still alive, and relaunch the
// scripts of lines that were left running (e.g. after a reboot) but never stopped.
async function restoreRunningLines() {
  const saved = readRunState();
  for (const [lineKey, entry] of Object.entries(saved.lines)) {
    if (runningLineProcesses.get(lineKey)) continue;

    if (entry.pid && isTrackedTerminalAlive(entry.pid)) {
      trackLineProcess(lineKey, entry.pid, entry.skuLabel);
      continue;
    }

    const res = await startLineScript({
      scriptPath: entry.scriptPath,
      args: entry.args,
      lineName: lineKey,
      ocrConfig: entry.ocrConfig,
      skuLabel: entry.skuLabel
    });
    if (!res.ok) {
      // Keep the entry so it is retried next start (e.g. script on a drive not yet mounted).
      console.error(`Failed to resume ${lineKey}:`, res.message);
    }
  }
}

ipcMain.handle("run:python", async (_evt, payload) => {
  await restoreRunStatePromise;
  return startLineScript(payload || {});
});

async function startLineScript({ scriptPath, args = [], lineName, ocrConfig, skuLabel }) {
  if (!scriptPath) return { ok: false, message: "Missing scriptPath" };

  try {
    const ocrResult = updateOcrConfig({ ocrConfig });
    if (!ocrResult.ok) {
      return { ok: false, message: ocrResult.message || "Failed to update OCR config." };
    }

    const { scriptPath: cleanScriptPath, extraArgs } = splitScriptPathAndArgs(scriptPath);
    const normalizedScriptPath = path.normalize(cleanScriptPath);
    if (!fs.existsSync(normalizedScriptPath)) {
      return { ok: false, message: `Script file not found: ${cleanScriptPath}` };
    }

    const cfg = readConfig();
    const configuredPythonExe = (cfg && cfg.python && cfg.python.exe)
      ? stripWrappingQuotes(cfg.python.exe)
      : "python";
    const pythonLauncher = resolvePythonLauncher(configuredPythonExe);
    const scriptCommand = buildScriptCommand({
      normalizedScriptPath,
      args: [...extraArgs, ...(args || [])],
      pythonLauncher
    });
    if (!scriptCommand.ok) {
      return { ok: false, message: scriptCommand.message };
    }
    const commandToRun = scriptCommand.command;
    const lineKey = getLineProcessKey(lineName);
    const existingPid = runningLineProcesses.get(lineKey);
    if (existingPid) {
      return {
        ok: false,
        lineName: lineKey,
        message: `A script is already running for ${lineKey}. Click Stop Code first.`
      };
    }
    const activeCooldownMs = getRemainingCooldownMs(lineKey);
    if (activeCooldownMs > 0) {
      return {
        ok: false,
        lineName: lineKey,
        cooldownActive: true,
        cooldownMsRemaining: activeCooldownMs,
        message: `Please wait ${Math.ceil(activeCooldownMs / 1000)} seconds before running ${lineKey} again.`
      };
    }
    clearExpiredCooldown(lineKey);

    const wd = path.dirname(normalizedScriptPath);
    const psScript = [
      "$ErrorActionPreference='Stop';",
      "$ProgressPreference='SilentlyContinue';",
      `$wd='${escapeForPowerShellSingle(wd)}';`,
      `$cmd='${escapeForPowerShellSingle(commandToRun)}';`,
      "$procId = (Start-Process -FilePath 'cmd.exe' -WorkingDirectory $wd -WindowStyle Minimized -ArgumentList @('/k', $cmd) -PassThru).Id;",
      "[Console]::WriteLine($procId);"
    ].join(" ");

    const encodedPs = Buffer.from(psScript, "utf16le").toString("base64");
    const powershellExe = path.join(
      process.env.WINDIR || "C:\\Windows",
      "System32",
      "WindowsPowerShell",
      "v1.0",
      "powershell.exe"
    );
    const starter = spawn(powershellExe, [
      "-NoProfile",
      "-NonInteractive",
      "-ExecutionPolicy",
      "Bypass",
      "-EncodedCommand",
      encodedPs
    ], {
      windowsHide: true,
      shell: false,
      stdio: ["ignore", "pipe", "pipe"],
      // inherited by Start-Process -> cmd.exe -> python and its child processes
      env: { ...process.env, PLC_BRIDGE_PORT: String(getPlcPort(lineKey)) }
    });

    const pid = await new Promise((resolve, reject) => {
      let out = "";
      let err = "";
      starter.stdout?.on("data", (buf) => { out += String(buf); });
      starter.stderr?.on("data", (buf) => { err += String(buf); });
      starter.on("error", reject);
      starter.on("exit", (code) => {
        if (code !== 0) {
          reject(new Error(err.trim() || out.trim() || `Failed to start minimized terminal (code ${code}).`));
          return;
        }
        const match = out.match(/\d+/);
        const parsed = match ? Number(match[0]) : NaN;
        if (!Number.isFinite(parsed) || parsed <= 0) {
          const safeOut = out.trim().slice(0, 240);
          const safeErr = err.trim().slice(0, 240);
          reject(new Error(
            safeErr || safeOut || "Failed to read PID from minimized terminal start."
          ));
          return;
        }
        resolve(parsed);
      });
    });
    setLineRunState(lineKey, {
      scriptPath,
      args,
      ocrConfig,
      skuLabel: String(skuLabel || ""),
      pid,
      startedAt: Date.now()
    });
    if (isShuttingDown) {
      stopProcessTree(pid);
      return { ok: false, lineName: lineKey, message: "App is shutting down." };
    }
    trackLineProcess(lineKey, pid, skuLabel);

    return { ok: true, lineName: lineKey };
  } catch (e) {
    return { ok: false, message: e?.message || "Failed to start minimized terminal." };
  }
}

ipcMain.handle("run:stop", async (_evt, { lineName }) => {
  await restoreRunStatePromise;
  const lineKey = getLineProcessKey(lineName);
  const pid = runningLineProcesses.get(lineKey);
  if (!pid) {
    // Line is not running (e.g. its resume failed): make sure it is not resumed on next start.
    clearLineRunState(lineKey);
    const cooldownMsRemaining = getRemainingCooldownMs(lineKey);
    if (cooldownMsRemaining > 0) {
      return {
        ok: true,
        stopped: false,
        cooldownActive: true,
        cooldownMsRemaining,
        message: `Cooldown active for ${lineKey}. Please wait ${Math.ceil(cooldownMsRemaining / 1000)} seconds.`
      };
    }
    return { ok: true, stopped: false, message: "No running terminal for this line." };
  }

  const stopped = stopProcessTree(pid);
  if (stopped) {
    runningLineProcesses.delete(lineKey);
    const activeSkuLabel = runningLineSkuLabels.get(lineKey) || "";
    runningLineSkuLabels.delete(lineKey);
    clearLinePoller(lineKey);
    clearLineRunState(lineKey);
    startLineCooldown(lineKey, activeSkuLabel, "stopped");
    return { ok: true, stopped: true, cooldownActive: true, cooldownMsRemaining: STOP_COOLDOWN_MS };
  }

  return { ok: false, stopped: false, message: "Failed to stop terminal process." };
});

ipcMain.handle("plc:status", async (_evt, { lineName } = {}) => {
  const lineKey = getLineProcessKey(lineName);
  const port = getPlcPort(lineKey);
  const res = await sendPlcBridgeCommand(port, "STATUS", PLC_STATUS_TIMEOUT_MS);
  if (!res.ok) return { ...unreachablePlcResult(lineKey, res), port };
  const data = parseBridgeReply(res.reply);
  const state = PLC_STATE_BY_BRIDGE[data?.plc];
  if (!state) return { ok: false, state: "error", port, message: `Unexpected bridge reply: ${res.reply}` };
  return {
    ok: true,
    state,
    port,
    singleDefect: Boolean(data.single_defect),
    consecutive: Number(data.consecutive) || null,
    defaultConsecutive: Number(data.default) || null
  };
});

ipcMain.handle("plc:set-single-defect", async (_evt, { lineName, enabled } = {}) => {
  const lineKey = getLineProcessKey(lineName);
  if (plcBusyLines.has(lineKey)) {
    return { ok: false, state: "busy", message: `A change is already in progress for ${lineKey}.` };
  }
  plcBusyLines.add(lineKey);
  try {
    const port = getPlcPort(lineKey);
    const command = `SINGLE_DEFECT ${enabled ? "ON" : "OFF"}`;
    const res = await sendPlcBridgeCommand(port, command, PLC_SET_TIMEOUT_MS);
    if (!res.ok) return unreachablePlcResult(lineKey, res);
    const data = parseBridgeReply(res.reply);
    if (!data) return { ok: false, state: "error", message: `Unexpected bridge reply: ${res.reply}` };
    if (!data.ok) {
      return { ok: false, state: "error", message: data.error || `Could not change ${lineKey}.` };
    }
    const singleDefect = Boolean(data.single_defect);
    const consecutive = Number(data.consecutive) || null;
    return {
      ok: true,
      singleDefect,
      consecutive,
      message: singleDefect
        ? `${lineKey}: rejecting on every single defect.`
        : `${lineKey}: rejecting after ${consecutive ?? "the configured number of"} consecutive defects.`
    };
  } finally {
    plcBusyLines.delete(lineKey);
  }
});

ipcMain.handle("run:get-state", async () => {
  await restoreRunStatePromise;
  return getRunStateSnapshot();
});

ipcMain.handle("camera-config:get", () => {
  return readCameraConfig();
});

ipcMain.handle("camera-config:set", (_evt, { cfg, role }) => {
  if (role !== "developer") {
    throw new Error("Permission denied: only developer can update camera config.");
  }
  writeCameraConfig(cfg);
  return { ok: true };
});

function applyClientDiagnosisUpdate(currentCfg, requestedCfg) {
  const nextPlc = requestedCfg?.plc && typeof requestedCfg.plc === "object" ? requestedCfg.plc : {};
  const ipAddress = String(nextPlc.ipAddress ?? currentCfg?.plc?.ipAddress ?? "0.0.0.0").trim() || "0.0.0.0";

  const requestedClick = requestedCfg?.click_status && typeof requestedCfg.click_status === "object"
    ? requestedCfg.click_status
    : {};

  function normalizeClick(value, fallback) {
    const v = String(value ?? "").trim().toLowerCase();
    if (v === "triggered" || v === "non-triggered") return v;
    return fallback;
  }

  const currentClick = currentCfg?.click_status || {};

  const click_status = {
    ping: normalizeClick(requestedClick.ping, currentClick.ping ?? "non-triggered"),
    rejection: normalizeClick(requestedClick.rejection, currentClick.rejection ?? "non-triggered"),
    heartbeat: normalizeClick(requestedClick.heartbeat, currentClick.heartbeat ?? "non-triggered")
  };

  function computeResponse(click) {
    return click === "triggered" ? "OK" : "NOK";
  }

  return {
    ...currentCfg,
    plc: { ...(currentCfg?.plc || {}), ipAddress },
    click_status,
    response_status: {
      ping: computeResponse(click_status.ping),
      rejection: computeResponse(click_status.rejection),
      heartbeat: computeResponse(click_status.heartbeat)
    }
  };
}

ipcMain.handle("diagnosis-config:get", () => {
  return readDiagnosisConfig();
});

ipcMain.handle("diagnosis-config:set", (_evt, { cfg, role }) => {
  if (role === "developer") {
    writeDiagnosisConfig(cfg);
    return { ok: true };
  }

  if (role === "client") {
    const current = readDiagnosisConfig();
    const next = applyClientDiagnosisUpdate(current, cfg);
    writeDiagnosisConfig(next);
    return { ok: true };
  }

  throw new Error("Permission denied: unknown role.");
});

ipcMain.handle("diagnosis-mappings:get", () => {
  return readDiagnosisMappings();
});

ipcMain.handle("diagnosis-mappings:set", (_evt, { cfg, role }) => {
  if (role !== "developer") {
    throw new Error("Permission denied: only developer can update diagnosis mappings.");
  }
  writeDiagnosisMappings(cfg);
  return { ok: true };
});

ipcMain.handle("diagnosis:images:list", async (_evt, { dirPath, limit = 24 } = {}) => {
  const cleaned = String(dirPath || "").trim();
  if (!cleaned) return { ok: false, message: "Missing dirPath", images: [] };

  try {
    const resolved = path.resolve(cleaned);
    if (!fs.existsSync(resolved)) return { ok: false, message: `Path not found: ${cleaned}`, images: [] };
    const stat = fs.statSync(resolved);
    if (!stat.isDirectory()) return { ok: false, message: `Not a folder: ${cleaned}`, images: [] };

    const allowedExt = new Set([".jpg", ".jpeg", ".png", ".bmp", ".gif", ".webp"]);
    const entries = fs.readdirSync(resolved, { withFileTypes: true })
      .filter((d) => d.isFile())
      .map((d) => d.name)
      .filter((name) => allowedExt.has(path.extname(name).toLowerCase()))
      .sort((a, b) => a.localeCompare(b));

    const max = Math.max(1, Math.min(Number(limit) || 24, 100));
    const slice = entries.slice(0, max);

    const images = slice.map((name) => {
      const full = path.join(resolved, name);
      const ext = path.extname(name).toLowerCase();
      const mime =
        ext === ".png" ? "image/png" :
        ext === ".gif" ? "image/gif" :
        ext === ".webp" ? "image/webp" :
        ext === ".bmp" ? "image/bmp" :
        "image/jpeg";

      const buf = fs.readFileSync(full);
      const base64 = buf.toString("base64");
      return {
        name,
        fullPath: full,
        dataUrl: `data:${mime};base64,${base64}`
      };
    });

    return { ok: true, images };
  } catch (e) {
    return { ok: false, message: e?.message || "Failed to read images", images: [] };
  }
});
