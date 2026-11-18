const fs = require("fs");
const path = require("path");

const DIAGNOSIS_MAPPINGS_PATH = "C:\\Users\\Rupesh\\demoprojects\\configs_Gui\\diagnosis.json";

const defaultDiagnosisMappings = {
  mappings: {}
};

function ensureDir(filePath) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function normalizeMappings(raw) {
  const mappings = raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {};
  const cleaned = {};

  for (const [lineNameRaw, cameraMapRaw] of Object.entries(mappings)) {
    const lineName = String(lineNameRaw || "").trim();
    if (!lineName) continue;
    const cameraMap = cameraMapRaw && typeof cameraMapRaw === "object" && !Array.isArray(cameraMapRaw)
      ? cameraMapRaw
      : {};
    const cleanedCameraMap = {};
    for (const [cameraNameRaw, imagePathRaw] of Object.entries(cameraMap)) {
      const cameraName = String(cameraNameRaw || "").trim();
      if (!cameraName) continue;
      const imagePath = String(imagePathRaw ?? "").trim();
      if (!imagePath) continue;
      cleanedCameraMap[cameraName] = imagePath;
    }
    cleaned[lineName] = cleanedCameraMap;
  }

  return cleaned;
}

function normalizeDiagnosisMappings(cfg) {
  const next = cfg && typeof cfg === "object" && !Array.isArray(cfg) ? cfg : {};
  next.mappings = normalizeMappings(next.mappings);
  return next;
}

function readDiagnosisMappings(filePath = DIAGNOSIS_MAPPINGS_PATH) {
  ensureDir(filePath);
  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, JSON.stringify(defaultDiagnosisMappings, null, 2), "utf-8");
  }
  const raw = fs.readFileSync(filePath, "utf-8");
  return normalizeDiagnosisMappings(JSON.parse(raw || "{}"));
}

function writeDiagnosisMappings(nextConfig, filePath = DIAGNOSIS_MAPPINGS_PATH) {
  ensureDir(filePath);
  const normalized = normalizeDiagnosisMappings(nextConfig);
  fs.writeFileSync(filePath, JSON.stringify(normalized, null, 2), "utf-8");
  return true;
}

module.exports = { readDiagnosisMappings, writeDiagnosisMappings, DIAGNOSIS_MAPPINGS_PATH };

