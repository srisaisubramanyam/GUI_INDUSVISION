const fs = require("fs");
const path = require("path");
const { getConfigPath } = require("./configPaths.cjs");

const FIXED_CONFIG_PATH = getConfigPath("defect_toggle.json");

const defaultConfig = {
  defectToggles: { items: [] },
  python: { exe: "python" },
  code: { lines: {} },
  camera: { frames: [] },
  dataCollection: { sku_name: "", scriptPath: "C:/Users/Rupesh/dummypythonfiles/infinite_counter.py", outputDir: "C:\\data\\collection", runEnabled: false }
};

function ensureDir(filePath) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
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

  next.code ??= { lines: {} };
  next.code.lines ??= {};

  for (const k of Object.keys(next.code.lines)) {
    next.code.lines[k] = (next.code.lines[k] || []).map((it, idx) => ({
      id: it.id || `sku_${k.replace(/\s/g, "")}_${idx}_${Date.now()}`,
      label: it.label ?? it.name ?? `SKU ${idx + 1}`,
      scriptPath: it.scriptPath ?? ""
    }));
  }

  next.camera ??= { frames: [] };
  next.camera.frames ??= [];
  next.camera.frames = next.camera.frames.map((f, idx) => ({
    id: f.id || `cam_${idx}_${Date.now()}`,
    name: f.name ?? `Camera ${idx + 1}`,
    source: f.source ?? "",
    enabled: f.enabled !== false
  }));

  next.dataCollection ??= { sku_name: "", scriptPath: "C:/Users/Rupesh/dummypythonfiles/infinite_counter.py", outputDir: "C:\\data\\collection", runEnabled: false };
  next.dataCollection.sku_name ??= "";
  next.dataCollection.scriptPath ??= "C:/Users/Rupesh/dummypythonfiles/infinite_counter.py";
  next.dataCollection.outputDir ??= "C:\\data\\collection";
  next.dataCollection.runEnabled = Boolean(next.dataCollection.runEnabled);

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
