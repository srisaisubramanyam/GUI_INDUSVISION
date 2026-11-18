const fs = require("fs");
const path = require("path");
const { getConfigPath } = require("./configPaths.cjs");

const DIAGNOSIS_CONFIG_PATH = getConfigPath("diagnosis.json");

const defaultDiagnosisConfig = {
  plc: {
    ipAddress: "0.0.0.0"
  },
  click_status: {
    ping: "triggered",
    rejection: "triggered",
    heartbeat: "triggered"
  },
  response_status: {
    ping: "OK",
    rejection: "OK",
    heartbeat: "OK"
  }
};

function ensureDir(filePath) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function normalizeIpAddress(raw) {
  const ip = raw && typeof raw === "object" && !Array.isArray(raw) ? raw.ipAddress : raw?.ipAddress;
  const cleaned = String(ip ?? defaultDiagnosisConfig.plc.ipAddress).trim() || defaultDiagnosisConfig.plc.ipAddress;
  return { ipAddress: cleaned };
}

function normalizeClickStatus(raw) {
  const obj = raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {};
  function one(key) {
    const v = String(obj[key] ?? "").trim().toLowerCase();
    if (v === "triggered" || v === "non-triggered") return v;
    return "non-triggered";
  }
  return {
    ping: one("ping"),
    rejection: one("rejection"),
    heartbeat: one("heartbeat")
  };
}

function computeResponse(clickStatus) {
  return clickStatus === "triggered" ? "OK" : "NOK";
}

function normalizeResponseStatus(raw, clickStatus) {
  const obj = raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {};
  function one(key) {
    const v = String(obj[key] ?? "").trim().toUpperCase();
    if (v === "OK" || v === "NOK") return v;
    return computeResponse(clickStatus[key]);
  }
  return {
    ping: one("ping"),
    rejection: one("rejection"),
    heartbeat: one("heartbeat")
  };
}

function normalizeDiagnosisConfig(cfg) {
  const next = cfg && typeof cfg === "object" && !Array.isArray(cfg) ? cfg : {};
  next.plc = normalizeIpAddress(next.plc);
  next.click_status = normalizeClickStatus(next.click_status);
  next.response_status = normalizeResponseStatus(next.response_status, next.click_status);
  return next;
}

function readDiagnosisConfig(filePath = DIAGNOSIS_CONFIG_PATH) {
  ensureDir(filePath);
  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, JSON.stringify(defaultDiagnosisConfig, null, 2), "utf-8");
  }

  const raw = fs.readFileSync(filePath, "utf-8");
  return normalizeDiagnosisConfig(JSON.parse(raw || "{}"));
}

function writeDiagnosisConfig(nextConfig, filePath = DIAGNOSIS_CONFIG_PATH) {
  ensureDir(filePath);
  const normalized = normalizeDiagnosisConfig(nextConfig);
  fs.writeFileSync(filePath, JSON.stringify(normalized, null, 2), "utf-8");
  return true;
}

module.exports = { readDiagnosisConfig, writeDiagnosisConfig, DIAGNOSIS_CONFIG_PATH };
