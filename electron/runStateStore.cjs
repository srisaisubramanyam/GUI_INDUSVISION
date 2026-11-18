const fs = require("fs");
const path = require("path");
const { getConfigPath } = require("./configPaths.cjs");

// Remembers which line scripts were left running, so they can be resumed
// after the app (or the whole system) is closed and opened again.
const RUN_STATE_PATH = getConfigPath("run_state.json");

const defaultRunState = {
  lines: {}
};

function ensureDir(filePath) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function normalizeRunState(cfg) {
  const next = cfg && typeof cfg === "object" && !Array.isArray(cfg) ? cfg : {};
  const lines = next.lines && typeof next.lines === "object" && !Array.isArray(next.lines) ? next.lines : {};

  const cleaned = {};
  for (const [lineKeyRaw, entry] of Object.entries(lines)) {
    const lineKey = String(lineKeyRaw || "").trim();
    if (!lineKey || !entry || typeof entry !== "object") continue;
    const scriptPath = String(entry.scriptPath ?? "").trim();
    if (!scriptPath) continue;
    cleaned[lineKey] = {
      scriptPath,
      args: Array.isArray(entry.args) ? entry.args.map((a) => String(a ?? "")) : [],
      ocrConfig: entry.ocrConfig && typeof entry.ocrConfig === "object" && !Array.isArray(entry.ocrConfig)
        ? entry.ocrConfig
        : {},
      skuLabel: String(entry.skuLabel ?? ""),
      pid: Number(entry.pid) > 0 ? Number(entry.pid) : null,
      startedAt: Number(entry.startedAt) > 0 ? Number(entry.startedAt) : null
    };
  }

  return { lines: cleaned };
}

function readRunState(filePath = RUN_STATE_PATH) {
  try {
    if (!fs.existsSync(filePath)) return structuredClone(defaultRunState);
    const raw = fs.readFileSync(filePath, "utf-8");
    return normalizeRunState(JSON.parse(raw || "{}"));
  } catch (e) {
    console.error("Failed to read run_state.json:", e);
    return structuredClone(defaultRunState);
  }
}

function writeRunState(nextState, filePath = RUN_STATE_PATH) {
  ensureDir(filePath);
  const normalized = normalizeRunState(nextState);
  fs.writeFileSync(filePath, JSON.stringify(normalized, null, 2), "utf-8");
  return true;
}

function setLineRunState(lineKey, entry) {
  try {
    const state = readRunState();
    state.lines[lineKey] = entry;
    writeRunState(state);
  } catch (e) {
    console.error("Failed to save run state:", e);
  }
}

function clearLineRunState(lineKey) {
  try {
    const state = readRunState();
    if (!state.lines[lineKey]) return;
    delete state.lines[lineKey];
    writeRunState(state);
  } catch (e) {
    console.error("Failed to clear run state:", e);
  }
}

module.exports = { readRunState, setLineRunState, clearLineRunState, RUN_STATE_PATH };
