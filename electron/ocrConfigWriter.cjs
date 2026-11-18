const fs = require("fs");
const path = require("path");
const { getConfigPath } = require("./configPaths.cjs");

const CONFIG_PATH = getConfigPath("defect_toggle.json");
const OCR_CONFIG_KEY = "ocrconfigs";

function readExistingConfig() {
  if (!fs.existsSync(CONFIG_PATH)) return {};

  const raw = fs.readFileSync(CONFIG_PATH, "utf-8");
  if (!raw.trim()) return {};

  const parsed = JSON.parse(raw);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
  return parsed;
}

function saveOcrConfig(config) {
  if (!config || typeof config !== "object" || Array.isArray(config)) {
    throw new Error("OCR config must be a JSON object.");
  }

  // Always store OCR config under named sections; wrap flat configs in "default".
  const isPlainObject = (v) => v && typeof v === "object" && !Array.isArray(v);
  const values = Object.values(config);
  const isFlat = values.length > 0 && !values.some(isPlainObject);
  const normalized = isFlat ? { default: { ...config } } : { ...config };

  const existingConfig = readExistingConfig();
  const mergedConfig = { ...existingConfig, [OCR_CONFIG_KEY]: normalized };

  // Clean legacy root OCR keys so OCR appears only once under `ocrconfigs`.
  for (const key of Object.keys(config)) {
    if (key in mergedConfig && key !== OCR_CONFIG_KEY) {
      delete mergedConfig[key];
    }
  }

  fs.mkdirSync(path.dirname(CONFIG_PATH), { recursive: true });
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(mergedConfig, null, 2), "utf-8");
  return CONFIG_PATH;
}

function updateOcrConfig({ ocrConfig }) {
  try {
    const writtenPath = saveOcrConfig(ocrConfig);
    return { ok: true, skipped: false, configPath: writtenPath };
  } catch (err) {
    return {
      ok: false,
      skipped: false,
      reason: "invalid_ocr_config",
      message: err?.message || "Invalid OCR config",
      configPath: CONFIG_PATH
    };
  }
}

module.exports = { updateOcrConfig, CONFIG_PATH, OCR_CONFIG_KEY };
