const fs = require("fs");
const path = require("path");
const { getConfigPath } = require("./configPaths.cjs");

const CAMERA_CONFIG_PATH = getConfigPath("cameraconfig.json");

const defaultCameraConfig = {
  cameraImage: {}
};

function ensureDir(filePath) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function normalizeCameraConfig(cfg) {
  const next = cfg && typeof cfg === "object" && !Array.isArray(cfg) ? cfg : {};
  next.cameraImage ??= {};

  if (!next.cameraImage || typeof next.cameraImage !== "object" || Array.isArray(next.cameraImage)) {
    next.cameraImage = {};
  }

  const cleaned = {};
  for (const [key, value] of Object.entries(next.cameraImage)) {
    const name = String(key || "").trim();
    if (!name) continue;
    cleaned[name] = String(value ?? "");
  }
  next.cameraImage = cleaned;

  return next;
}

function readCameraConfig(filePath = CAMERA_CONFIG_PATH) {
  ensureDir(filePath);
  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, JSON.stringify(defaultCameraConfig, null, 2), "utf-8");
  }

  const raw = fs.readFileSync(filePath, "utf-8");
  return normalizeCameraConfig(JSON.parse(raw || "{}"));
}

function writeCameraConfig(nextConfig, filePath = CAMERA_CONFIG_PATH) {
  ensureDir(filePath);
  const normalized = normalizeCameraConfig(nextConfig);
  fs.writeFileSync(filePath, JSON.stringify(normalized, null, 2), "utf-8");
  return true;
}

module.exports = { readCameraConfig, writeCameraConfig, CAMERA_CONFIG_PATH };
