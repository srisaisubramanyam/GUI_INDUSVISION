const fs = require("fs");
const path = require("path");
const { getConfigPath } = require("./configPaths.cjs");

const FIXED_CONFIG_PATH = getConfigPath("defect_toggle.json");

const SEEDED_SAMPLE_LINES = {
  "Line 1": [
    
  ],
  "Line 2": [
    
  ],
  "Line 3": [
    
  ],
  "Line 4": [
    
  ]
};

const defaultConfig = {
  defectToggles: { items: [] },
  python: { exe: "python" },
  code: {
    lines: {}
  },
  camera: { frames: [] },
  dataCollection: { sku_name: "", scriptPath: "C:/Users/Rupesh/dummypythonfiles/infinite_counter.py", outputDir: "C:\\data\\collection", runEnabled: false }
};

function ensureDir(filePath) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function normalizeLineItems(lineName, items) {
  const arr = Array.isArray(items) ? items : [];

  return arr
    .map((it, idx) => {
      if (typeof it === "string") return it;

      if (it && typeof it === "object") {
        const label = it.label ?? it.name ?? `SKU ${idx + 1}`;
        const scriptPath = it.scriptPath ?? "";
        const ocrConfig = (it.ocrConfig && typeof it.ocrConfig === "object" && !Array.isArray(it.ocrConfig))
          ? it.ocrConfig
          : {};
        return { label, scriptPath, ocrConfig };
      }

      return `SKU ${lineName} ${idx + 1}`;
    })
    .filter(Boolean);
}

function normalizeConfig(cfg) {
  const next = cfg && typeof cfg === "object" ? cfg : {};

  next.defectToggles ??= { items: [] };
  next.defectToggles.items ??= [];
  next.defectToggles.items = next.defectToggles.items.map((x, i) => ({
    id: x.id || `def_${i}_${Date.now()}`,
    name: x.name ?? x.label ?? `Toggle ${i + 1}`,
    enabled: Boolean(x.enabled)
  }));

  next.python ??= { exe: "python" };
  next.python.exe ??= "python";

  // Support both formats:
  // 1) { code: { lines: { ... } } }
  // 2) { lines: { ... } }  (legacy/manual edits)
  if (!next.code?.lines && next.lines && typeof next.lines === "object") {
    next.code = { ...(next.code || {}), lines: next.lines };
  }

  next.code ??= { lines: {} };
  next.code.lines ??= {};

  for (const lineName of Object.keys(next.code.lines)) {
    next.code.lines[lineName] = normalizeLineItems(lineName, next.code.lines[lineName]);
  }

  if (next.lines) delete next.lines;

  // Migration: older builds seeded sample Line 1..4 with many SKU buttons by default.
  // If the current file still matches that exact seed, start with an empty set.
  try {
    const keys = Object.keys(next.code.lines || {});
    const seedKeys = Object.keys(SEEDED_SAMPLE_LINES);
    const sameKeys =
      keys.length === seedKeys.length &&
      keys.every((k) => seedKeys.includes(k));

    if (sameKeys) {
      const matches = keys.every((k) => {
        const a = next.code.lines[k];
        const b = SEEDED_SAMPLE_LINES[k];
        if (!Array.isArray(a) || !Array.isArray(b)) return false;
        if (a.length !== b.length) return false;
        for (let i = 0; i < a.length; i++) {
          if (a[i] !== b[i]) return false;
        }
        return true;
      });

      if (matches) next.code.lines = {};
    }
  } catch {
    // ignore
  }

  next.camera ??= { frames: [] };
  next.camera.frames ??= [];
  next.camera.frames = next.camera.frames.map((f, idx) => ({
    id: f.id || `cam_${idx}_${Date.now()}`,
    name: f.name ?? `Camera ${idx + 1}`,
    source: f.source ?? "",
    enabled: f.enabled !== false
  }));

  const rawDataCollection =
    next.dataCollection && typeof next.dataCollection === "object" && !Array.isArray(next.dataCollection)
      ? next.dataCollection
      : {};
  next.dataCollection = {
    sku_name: rawDataCollection.sku_name ?? "",
    scriptPath: rawDataCollection.scriptPath ?? "C:/Users/Rupesh/dummypythonfiles/infinite_counter.py",
    outputDir: rawDataCollection.outputDir ?? "C:\\data\\collection",
    runEnabled: Boolean(rawDataCollection.runEnabled)
  };

  return next;
}

function readConfig(filePath = FIXED_CONFIG_PATH) {
  ensureDir(filePath);

  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, JSON.stringify(defaultConfig, null, 2), "utf-8");
  }

  const raw = fs.readFileSync(filePath, "utf-8");
  const parsed = normalizeConfig(JSON.parse(raw || "{}"));
  return parsed;
}

function writeConfig(nextConfig, filePath = FIXED_CONFIG_PATH) {
  ensureDir(filePath);
  const normalized = normalizeConfig(nextConfig);
  fs.writeFileSync(filePath, JSON.stringify(normalized, null, 2), "utf-8");
  return true;
}

module.exports = { readConfig, writeConfig, FIXED_CONFIG_PATH };
