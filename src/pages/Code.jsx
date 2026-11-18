import { useEffect, useMemo, useRef, useState } from "react";
import Card from "../components/Card.jsx";
import Button from "../components/Button.jsx";
import Input from "../components/Input.jsx";
import Select from "../components/Select.jsx";
import Modal from "../components/Modal.jsx";
import { useToast } from "../components/useToast.jsx";
import { useElectronAPI } from "../utils/electronAPI.js";
import { ChevronDown, ChevronRight, Play, Plus, Square, Trash2, Wrench } from "lucide-react";

const isDev = () => localStorage.getItem("role") === "developer";
const SCRIPT_PATH_EXAMPLE = "C:/Users/Rupesh/dummypythonfiles/infinite_counter.py";
const SUPPORTED_SCRIPT_EXTENSIONS = [".py", ".bat", ".cmd"];
const DEFAULT_STOP_COOLDOWN_MS = 20 * 1000;
const createEmptyOcrGroup = (name = "") => ({
  name,
  fields: [{ key: "", value: "" }]
});
const createDefaultOcrGroups = () => [createEmptyOcrGroup("default")];

function toSku(raw, idx) {
  if (typeof raw === "string") {
    return {
      id: `sku_${idx}_${raw}`,
      label: raw,
      scriptPath: "",
      ocrConfig: {}
    };
  }

  if (raw && typeof raw === "object") {
    return {
      id: raw.id || `sku_${idx}_${raw.label || raw.name || "item"}`,
      label: raw.label ?? raw.name ?? `SKU ${idx + 1}`,
      scriptPath: raw.scriptPath ?? "",
      ocrConfig: raw.ocrConfig && typeof raw.ocrConfig === "object" && !Array.isArray(raw.ocrConfig)
        ? raw.ocrConfig
        : {}
    };
  }

  return {
    id: `sku_${idx}_unknown`,
    label: `SKU ${idx + 1}`,
    scriptPath: "",
    ocrConfig: {}
  };
}

function normalizeScriptPath(raw) {
  const trimmed = String(raw || "").trim();
  const withoutQuotes =
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
      ? trimmed.slice(1, -1).trim()
      : trimmed;
  return withoutQuotes.replace(/\\/g, "/");
}

function getScriptExtension(script) {
  const fileName = normalizeScriptPath(script).split("/").pop() || "";
  const dotIndex = fileName.lastIndexOf(".");
  return dotIndex >= 0 ? fileName.slice(dotIndex).toLowerCase() : "";
}

function parsePrimitive(value) {
  const v = String(value ?? "").trim();
  if (v === "") return "";
  if (v === "true") return true;
  if (v === "false") return false;
  if (v === "null") return null;
  if (!Number.isNaN(Number(v)) && v !== "") return Number(v);
  return v;
}

function valueToInput(value) {
  if (typeof value === "string") return value;
  return String(value);
}

function isPlainObject(value) {
  return value && typeof value === "object" && !Array.isArray(value);
}

function fieldsFromConfigObject(config) {
  return Object.entries(config || {}).map(([key, value]) => ({ key, value: valueToInput(value) }));
}

function groupsFromOcrConfig(ocrConfig) {
  if (!isPlainObject(ocrConfig) || Object.keys(ocrConfig).length === 0) {
    return createDefaultOcrGroups();
  }

  const entries = Object.entries(ocrConfig);
  const hasNestedGroups = entries.some(([, value]) => isPlainObject(value));
  if (!hasNestedGroups) {
    return [{
      name: "default",
      fields: fieldsFromConfigObject(ocrConfig)
    }];
  }

  const groups = entries
    .filter(([, value]) => isPlainObject(value))
    .map(([name, value]) => ({
      name,
      fields: Object.keys(value).length > 0
        ? fieldsFromConfigObject(value)
        : [{ key: "", value: "" }]
    }));

  const flatFields = entries
    .filter(([, value]) => !isPlainObject(value))
    .map(([key, value]) => ({ key, value: valueToInput(value) }));

  if (flatFields.length > 0) {
    groups.push({ name: "default", fields: flatFields });
  }

  return groups;
}

function getRemainingSeconds(cooldownUntil) {
  if (!cooldownUntil) return 0;
  return Math.max(0, Math.ceil((cooldownUntil - Date.now()) / 1000));
}

export default function Code() {
  const toast = useToast();
  const [cfg, setCfg] = useState(null);
  const [loading, setLoading] = useState(true);
  const [expandedLines, setExpandedLines] = useState({});
  const [lineRunning, setLineRunning] = useState({});
  const [lineCooldowns, setLineCooldowns] = useState({});
  const [stopCooldownMs, setStopCooldownMs] = useState(DEFAULT_STOP_COOLDOWN_MS);
  const [countdownNow, setCountdownNow] = useState(Date.now());

  const [openSku, setOpenSku] = useState(false);
  const [openLine, setOpenLine] = useState(false);
  const [openOcr, setOpenOcr] = useState(false);
  const runningToastByLineRef = useRef({});

  const [line, setLine] = useState("");
  const [newLineName, setNewLineName] = useState("");

  const [label, setLabel] = useState("");
  const [scriptPath, setScriptPath] = useState("");
  const [ocrGroups, setOcrGroups] = useState(createDefaultOcrGroups);

  const [ocrEditLine, setOcrEditLine] = useState("");
  const [ocrEditIndex, setOcrEditIndex] = useState(-1);

  const lineKeys = useMemo(() => Object.keys(cfg?.code?.lines || {}), [cfg]);

  useEffect(() => {
    if (!line && lineKeys.length > 0) {
      setLine(lineKeys[0]);
      return;
    }

    if (line && !lineKeys.includes(line)) {
      setLine(lineKeys[0] || "");
    }
  }, [lineKeys, line]);

  useEffect(() => {
    setExpandedLines((prev) => {
      const next = {};
      for (const key of lineKeys) {
        next[key] = typeof prev[key] === "boolean" ? prev[key] : isDev();
      }
      return next;
    });
  }, [lineKeys]);

  async function load() {
    setLoading(true);
    try {
      const api = await useElectronAPI();
      const c = await api.getConfig();
      setCfg(c);
    } catch (e) {
      toast.push("error", "Failed to load config");
    } finally {
      setLoading(false);
    }
  }

  async function save(next) {
    try {
      const api = await useElectronAPI();
      await api.setConfig(next);
      setCfg(next);
      return true;
    } catch (e) {
      toast.push("error", e?.message || "Failed to save config");
      return false;
    }
  }

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    let cancelled = false;
    let unsubscribe;

    (async () => {
      try {
        const api = await useElectronAPI();
        const snapshot = await api.getRunState();
        if (!cancelled && snapshot) {
          const nextRunning = {};
          Object.entries(snapshot.running || {}).forEach(([lineName, state]) => {
            nextRunning[lineName] = Boolean(state?.running);
          });
          setLineRunning(nextRunning);

          const nextCooldowns = {};
          Object.entries(snapshot.cooldowns || {}).forEach(([lineName, state]) => {
            if (state?.cooldownActive && state?.cooldownUntil) {
              nextCooldowns[lineName] = state.cooldownUntil;
            }
          });
          setLineCooldowns(nextCooldowns);

          if (snapshot.stopCooldownMs) {
            setStopCooldownMs(snapshot.stopCooldownMs);
          }
        }

        unsubscribe = api.onRunState((payload) => {
          if (payload?.type === "close-blocked") {
            const remainingSeconds = Math.max(
              1,
              Math.ceil(Number(payload?.cooldownMsRemaining || stopCooldownMs) / 1000)
            );
            toast.push("error", `Please wait ${remainingSeconds} seconds before closing the app.`);
            return;
          }

          const lineName = payload?.lineName;
          if (!lineName) return;

          setLineRunning((prev) => ({ ...prev, [lineName]: Boolean(payload?.running) }));
          setLineCooldowns((prev) => {
            const next = { ...prev };
            if (payload?.cooldownActive && payload?.cooldownUntil) {
              next[lineName] = payload.cooldownUntil;
            } else if (payload?.cooldownActive === false || payload?.cooldownMsRemaining === 0) {
              delete next[lineName];
            }
            return next;
          });

          if (payload?.running) return;

          const runningToastId = runningToastByLineRef.current[lineName];
          if (runningToastId) {
            toast.remove(runningToastId);
            delete runningToastByLineRef.current[lineName];
          }

          const skuLabel = String(payload?.skuLabel || "").trim();
          const skuText = skuLabel ? ` (${skuLabel})` : "";

          if (payload?.reason === "stopped") {
            toast.push("stopped", `Code stopped for ${lineName}${skuText}.`);
            return;
          }

          if (payload?.reason === "exited") {
            toast.push("stopped", `Terminal closed for ${lineName}${skuText}. Cooldown started.`);
          }
        });
      } catch (e) {
        // Ignore subscription errors in non-electron environments.
      }
    })();

    return () => {
      cancelled = true;
      if (typeof unsubscribe === "function") {
        unsubscribe();
      }
    };
  }, [stopCooldownMs, toast]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setCountdownNow(Date.now());
      setLineCooldowns((prev) => {
        let changed = false;
        const next = {};
        Object.entries(prev).forEach(([lineName, cooldownUntil]) => {
          if (cooldownUntil > Date.now()) {
            next[lineName] = cooldownUntil;
          } else {
            changed = true;
          }
        });
        return changed ? next : prev;
      });
    }, 1000);

    return () => window.clearInterval(timer);
  }, []);

  function getList(lineKey) {
    return cfg?.code?.lines?.[lineKey] || [];
  }

  function buildOcrConfigFromGroups() {
    const out = {};
    for (const group of ocrGroups) {
      const groupName = String(group.name || "").trim();
      if (!groupName) continue;

      const groupConfig = {};
      for (const row of group.fields || []) {
        const key = String(row.key || "").trim();
        if (!key) continue;
        groupConfig[key] = parsePrimitive(row.value);
      }

      out[groupName] = groupConfig;
    }
    return out;
  }

  function validateOcrGroups() {
    const names = [];
    for (const group of ocrGroups) {
      const name = String(group.name || "").trim();
      const hasAnyField = (group.fields || []).some((row) => String(row.key || "").trim());
      if (!name && hasAnyField) {
        toast.push("error", "Config label is required for each OCR config section");
        return false;
      }
      if (!name) continue;
      if (names.includes(name.toLowerCase())) {
        toast.push("error", `Duplicate OCR config label: ${name}`);
        return false;
      }
      names.push(name.toLowerCase());
    }
    return true;
  }

  function openOcrEditor(lineKey, idx) {
    const raw = getList(lineKey)[idx];
    const sku = toSku(raw, idx);
    setOcrGroups(groupsFromOcrConfig(sku.ocrConfig));
    setOcrEditLine(lineKey);
    setOcrEditIndex(idx);
    setOpenOcr(true);
  }

  async function saveOcrFieldsForSku() {
    if (!ocrEditLine || ocrEditIndex < 0) return;

    const next = structuredClone(cfg);
    const arr = [...(next.code.lines[ocrEditLine] || [])];
    const current = toSku(arr[ocrEditIndex], ocrEditIndex);
    if (!validateOcrGroups()) return;

    arr[ocrEditIndex] = {
      label: current.label,
      scriptPath: current.scriptPath,
      ocrConfig: buildOcrConfigFromGroups()
    };

    next.code.lines[ocrEditLine] = arr;
    const ok = await save(next);
    if (!ok) return;

    setOpenOcr(false);
    toast.push("success", "OCR config updated");
  }

  async function runSku(raw, idx, lineName) {
    const sku = toSku(raw, idx);
    const cooldownSeconds = getRemainingSeconds(lineCooldowns[lineName]);

    if (!sku.scriptPath) {
      toast.push("error", "No script path configured for this SKU");
      return;
    }

    if (cooldownSeconds > 0) {
      toast.push("info", `Please wait ${cooldownSeconds} seconds before running ${lineName} again.`);
      return;
    }

    try {
      const api = await useElectronAPI();
      const res = await api.runPython({
        scriptPath: sku.scriptPath,
        lineName,
        ocrConfig: sku.ocrConfig || {},
        skuLabel: sku.label
      });

      if (!res?.ok) {
        toast.push("error", res?.message || "Failed to run script");
        return;
      }
      setLineRunning((prev) => ({ ...prev, [lineName]: true }));
      const existingToastId = runningToastByLineRef.current[lineName];
      if (existingToastId) {
        toast.remove(existingToastId);
      }
      const toastId = toast.push("running", `Running SKU: ${sku.label} (${lineName})`, { persistent: true });
      runningToastByLineRef.current[lineName] = toastId;
    } catch (e) {
      toast.push("error", e?.message || "Failed to run script");
    }
  }

  async function stopLine(lineName) {
    try {
      const api = await useElectronAPI();
      const res = await api.stopPython({ lineName });
      if (res?.ok && res?.stopped) {
        setLineRunning((prev) => ({ ...prev, [lineName]: false }));
        return;
      }
      if (res?.cooldownActive) {
        toast.push("info", res?.message || `Cooldown active for ${lineName}`);
        return;
      }
      toast.push("info", res?.message || `No running terminal for ${lineName}`);
    } catch (e) {
      toast.push("error", e?.message || "Failed to stop running terminal");
    }
  }

  async function addLine() {
    if (!isDev()) return toast.push("error", "Only developer can add lines");

    const trimmed = newLineName.trim();
    if (!trimmed) return toast.push("error", "Line name is required");
    if (lineKeys.includes(trimmed)) return toast.push("error", "Line already exists");

    const next = structuredClone(cfg);
    next.code ??= {};
    next.code.lines ??= {};
    next.code.lines[trimmed] = [];

    const ok = await save(next);
    if (!ok) return;

    setLine(trimmed);
    setNewLineName("");
    setOpenLine(false);
    toast.push("success", "Line added");
  }

  async function removeLine(lineKey) {
    if (!isDev()) return toast.push("error", "Only developer can remove lines");

    const next = structuredClone(cfg);
    next.code ??= {};
    next.code.lines ??= {};

    if (!Object.prototype.hasOwnProperty.call(next.code.lines, lineKey)) {
      return toast.push("error", "Line not found");
    }

    delete next.code.lines[lineKey];

    const ok = await save(next);
    if (!ok) return;

    setExpandedLines((prev) => {
      const updated = { ...prev };
      delete updated[lineKey];
      return updated;
    });
    setLineRunning((prev) => {
      const updated = { ...prev };
      delete updated[lineKey];
      return updated;
    });
    toast.push("success", `Line removed: ${lineKey}`);
  }

  async function addSku() {
    if (!isDev()) return toast.push("error", "Only developer can add SKU buttons");
    if (!line) return toast.push("error", "Select a line first");
    if (!label.trim()) return toast.push("error", "Button label is required");

    const script = normalizeScriptPath(scriptPath);
    if (!script) {
      toast.push("error", `Script path is required. Example: ${SCRIPT_PATH_EXAMPLE}`);
      return;
    }

    if (!SUPPORTED_SCRIPT_EXTENSIONS.includes(getScriptExtension(script))) {
      toast.push("error", "Only .py, .bat, and .cmd script files are supported");
      return;
    }

    const next = structuredClone(cfg);
    const arr = next.code.lines[line] || [];
    if (!validateOcrGroups()) return;

    arr.push({
      label: label.trim(),
      scriptPath: script,
      ocrConfig: buildOcrConfigFromGroups()
    });
    next.code.lines[line] = arr;

    const ok = await save(next);
    if (!ok) return;

    setOpenSku(false);
    setLabel("");
    setScriptPath("");
    setOcrGroups(createDefaultOcrGroups());
    toast.push("success", "SKU button added");
  }

  async function removeSku(lineKey, index) {
    if (!isDev()) return toast.push("error", "Only developer can remove SKU buttons");

    const next = structuredClone(cfg);
    const arr = [...(next.code.lines[lineKey] || [])];
    arr.splice(index, 1);
    next.code.lines[lineKey] = arr;

    const ok = await save(next);
    if (!ok) return;

    toast.push("success", "SKU removed");
  }

  function addOcrGroup() {
    setOcrGroups((prev) => [...prev, createEmptyOcrGroup(`config_${prev.length + 1}`)]);
  }

  function removeOcrGroup(groupIndex) {
    setOcrGroups((prev) => prev.filter((_, i) => i !== groupIndex));
  }

  function changeOcrGroupName(groupIndex, name) {
    setOcrGroups((prev) => prev.map((group, i) => (i === groupIndex ? { ...group, name } : group)));
  }

  function addOcrFieldRow(groupIndex) {
    setOcrGroups((prev) => prev.map((group, i) => (
      i === groupIndex
        ? { ...group, fields: [...(group.fields || []), { key: "", value: "" }] }
        : group
    )));
  }

  function removeOcrFieldRow(groupIndex, fieldIndex) {
    setOcrGroups((prev) => prev.map((group, i) => (
      i === groupIndex
        ? { ...group, fields: (group.fields || []).filter((_, idx) => idx !== fieldIndex) }
        : group
    )));
  }

  function changeOcrField(groupIndex, fieldIndex, patch) {
    setOcrGroups((prev) => prev.map((group, i) => (
      i === groupIndex
        ? {
            ...group,
            fields: (group.fields || []).map((row, idx) => (idx === fieldIndex ? { ...row, ...patch } : row))
          }
        : group
    )));
  }

  if (loading) return <div className="text-[color:var(--muted)]">Loading...</div>;

  function toggleLine(lineKey) {
    setExpandedLines((prev) => ({ ...prev, [lineKey]: !prev[lineKey] }));
  }

  const activeCooldownEntries = Object.entries(lineCooldowns)
    .map(([lineName, cooldownUntil]) => ({
      lineName,
      cooldownUntil,
      remainingSeconds: getRemainingSeconds(cooldownUntil)
    }))
    .filter((entry) => entry.remainingSeconds > 0)
    .sort((a, b) => a.cooldownUntil - b.cooldownUntil);

  const activeCooldown = activeCooldownEntries[0] || null;

  return (
    <div className="space-y-6">
      {isDev() && (
        <div className="flex justify-end">
          <Button variant="secondary" onClick={() => setOpenLine(true)}>
            <Plus size={16} /> Add Line
          </Button>
        </div>
      )}

      <div className="grid gap-6">
        {lineKeys.map((lineKey) => (
          <Card
            key={lineKey}
            title={
              <button
                className="inline-flex items-center gap-2 text-[color:var(--text)] transition-colors hover:text-[color:var(--accent-hover)]"
                onClick={() => toggleLine(lineKey)}
              >
                {expandedLines[lineKey] ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                <span>{lineKey}</span>
              </button>
            }
            right={
              <div className="flex items-center gap-2">
                {!expandedLines[lineKey] ? (
                  <button
                    className="rounded-full border border-transparent px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.12em] text-[color:var(--muted)] transition-colors hover:border-[color:var(--border)] hover:text-[color:var(--accent-hover)]"
                    onClick={() => toggleLine(lineKey)}
                  >
                    Open
                  </button>
                ) : null}
                {isDev() && (
                  <>
                    <Button
                      variant="ghost"
                      onClick={() => {
                        setLine(lineKey);
                        setLabel("");
                        setScriptPath("");
                        setOcrGroups(createDefaultOcrGroups());
                        setOpenSku(true);
                      }}
                    >
                      <Plus size={16} /> Add SKU
                    </Button>
                    <Button
                      variant="ghost"
                      onClick={() => removeLine(lineKey)}
                      title={`Delete ${lineKey}`}
                    >
                      <Trash2 size={16} /> Delete Line
                    </Button>
                  </>
                )}
              </div>
            }
          >
            {expandedLines[lineKey] ? (
              <>
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {getList(lineKey).map((raw, idx) => {
                    const item = toSku(raw, idx);
                    const cooldownSeconds = getRemainingSeconds(lineCooldowns[lineKey]);
                    const isLongLabel = String(item.label || "").length > 24;

                    return (
                      <div
                        key={`${lineKey}_${item.id}_${idx}`}
                        className={`${isLongLabel ? "sm:col-span-2 " : ""}min-w-0 rounded-[26px] borderborder-[color:var(--border-strong)] bg-[linear-gradient(180deg,rgba(255,249,242,0.92),rgba(242,231,214,0.88))] p-4 shadow-[var(--shadow-sm)] transition-all hover:-translate-y-[1px] hover:shadow-[var(--shadow-md)]`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="text-lg font-extrabold text-[color:var(--text)] break-all">{item.label}</div>
                            <div className="mt-1 text-sm text-[color:var(--muted)]">Script-ready workspace action</div>
                          </div>
                          {isDev() && (
                            <div className="flex gap-1">
                              <button
                                className="rounded-2xl p-2 text-[color:var(--muted)] hover:bg-[rgba(255,249,242,0.9)]"
                                title="Edit OCR Config"
                                onClick={() => openOcrEditor(lineKey, idx)}
                              >
                                <Wrench size={16} />
                              </button>
                              <button
                                className="rounded-2xl p-2 text-[color:var(--muted)] hover:bg-[rgba(255,249,242,0.9)]"
                                title="Remove"
                                onClick={() => removeSku(lineKey, idx)}
                              >
                                <Trash2 size={16} />
                              </button>
                            </div>
                          )}
                        </div>

                        <div className="mt-4 flex gap-2">
                          <Button
                            className="flex-1"
                            onClick={() => runSku(raw, idx, lineKey)}
                            disabled={Boolean(lineRunning[lineKey]) || cooldownSeconds > 0}
                          >
                            <Play size={16} /> {cooldownSeconds > 0 ? `Wait ${cooldownSeconds}s` : "Run"}
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {getList(lineKey).length === 0 && (
                  <div className="text-sm text-[color:var(--muted)]">No SKUs configured.</div>
                )}

                <div className="mt-4">
                  <Button
                    variant="danger"
                    className="w-full"
                    onClick={() => stopLine(lineKey)}
                    title="Stop running terminal for this line"
                  >
                    <Square size={16} /> Stop Code
                  </Button>
                </div>
              </>
            ) : (
              <div className="text-sm text-[color:var(--muted)]">Click {lineKey} to view SKU buttons.</div>
            )}
          </Card>
        ))}
      </div>

      {lineKeys.length === 0 && (
        <Card title="Code Lines">
          <div className="text-sm text-[color:var(--muted)]">
            No lines configured. {isDev() ? "Use Add Line to create one." : "Ask developer to configure lines."}
          </div>
        </Card>
      )}

      <Modal open={openSku} title="Add SKU Button" onClose={() => setOpenSku(false)}>
        <div className="space-y-4">
          <Select label="Line" value={line} onChange={(e) => setLine(e.target.value)}>
            {lineKeys.map((x) => (
              <option key={x} value={x}>{x}</option>
            ))}
          </Select>

          <Input label="Button Label" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Japan - 80 gm" />

          <Input
            label="Script Path (.py, .bat, or .cmd)"
            value={scriptPath}
            onChange={(e) => setScriptPath(e.target.value)}
            placeholder={SCRIPT_PATH_EXAMPLE}
          />

          <div className="space-y-2 rounded-[24px] border border-[color:var(--border)] bg-[rgba(255,249,242,0.72)] p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="text-sm font-semibold">OCR Config Sections</div>
              <Button variant="ghost" onClick={addOcrGroup}><Plus size={14} /> Add Config</Button>
            </div>

            {ocrGroups.map((group, groupIndex) => (
              <div key={`ocr_new_group_${groupIndex}`} className="space-y-2 rounded-[18px] border border-[color:var(--border)] bg-[rgba(255,249,242,0.62)] p-3">
                <div className="grid grid-cols-[1fr_auto] gap-2">
                  <Input
                    label="Config Label"
                    value={group.name}
                    onChange={(e) => changeOcrGroupName(groupIndex, e.target.value)}
                    placeholder="left"
                  />
                  <Button variant="ghost" onClick={() => removeOcrGroup(groupIndex)}><Trash2 size={14} /></Button>
                </div>

                {(group.fields || []).map((row, fieldIndex) => (
                  <div key={`ocr_new_${groupIndex}_${fieldIndex}`} className="grid grid-cols-[1fr_1fr_auto] gap-2">
                    <Input
                      label=""
                      value={row.key}
                      onChange={(e) => changeOcrField(groupIndex, fieldIndex, { key: e.target.value })}
                      placeholder="field_name"
                    />
                    <Input
                      label=""
                      value={row.value}
                      onChange={(e) => changeOcrField(groupIndex, fieldIndex, { value: e.target.value })}
                      placeholder="value"
                    />
                    <Button variant="ghost" onClick={() => removeOcrFieldRow(groupIndex, fieldIndex)}><Trash2 size={14} /></Button>
                  </div>
                ))}
                <Button variant="ghost" onClick={() => addOcrFieldRow(groupIndex)}><Plus size={14} /> Add Field</Button>
              </div>
            ))}
          </div>

          <div className="flex gap-3 justify-end">
            <Button variant="ghost" onClick={() => setOpenSku(false)}>Cancel</Button>
            <Button onClick={addSku}><Plus size={16} /> Add</Button>
          </div>
        </div>
      </Modal>

      <Modal open={openOcr} title="Edit OCR Config" onClose={() => setOpenOcr(false)}>
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div className="text-sm font-semibold">OCR Config Sections</div>
            <Button variant="ghost" onClick={addOcrGroup}><Plus size={14} /> Add Config</Button>
          </div>

          {ocrGroups.map((group, groupIndex) => (
            <div key={`ocr_edit_group_${groupIndex}`} className="space-y-2 rounded-[18px] border border-[color:var(--border)] bg-[rgba(255,249,242,0.62)] p-3">
              <div className="grid grid-cols-[1fr_auto] gap-2">
                <Input
                  label="Config Label"
                  value={group.name}
                  onChange={(e) => changeOcrGroupName(groupIndex, e.target.value)}
                  placeholder="left"
                />
                <Button variant="ghost" onClick={() => removeOcrGroup(groupIndex)}><Trash2 size={14} /></Button>
              </div>

              {(group.fields || []).map((row, fieldIndex) => (
                <div key={`ocr_edit_${groupIndex}_${fieldIndex}`} className="grid grid-cols-[1fr_1fr_auto] gap-2">
                  <Input
                    label=""
                    value={row.key}
                    onChange={(e) => changeOcrField(groupIndex, fieldIndex, { key: e.target.value })}
                    placeholder="field_name"
                  />
                  <Input
                    label=""
                    value={row.value}
                    onChange={(e) => changeOcrField(groupIndex, fieldIndex, { value: e.target.value })}
                    placeholder="value"
                  />
                  <Button variant="ghost" onClick={() => removeOcrFieldRow(groupIndex, fieldIndex)}><Trash2 size={14} /></Button>
                </div>
              ))}
              <Button variant="ghost" onClick={() => addOcrFieldRow(groupIndex)}><Plus size={14} /> Add Field</Button>
            </div>
          ))}

          <div className="flex gap-3 justify-end">
            <Button variant="ghost" onClick={() => setOpenOcr(false)}>Cancel</Button>
            <Button onClick={saveOcrFieldsForSku}>Save OCR Config</Button>
          </div>
        </div>
      </Modal>

      <Modal open={openLine} title="Add Line" onClose={() => setOpenLine(false)}>
        <div className="space-y-4">
          <Input label="Line Name" value={newLineName} onChange={(e) => setNewLineName(e.target.value)} placeholder="Line 3" />

          <div className="flex gap-3 justify-end">
            <Button variant="ghost" onClick={() => setOpenLine(false)}>Cancel</Button>
            <Button onClick={addLine}><Plus size={16} /> Add</Button>
          </div>
        </div>
      </Modal>

      <Modal open={Boolean(activeCooldown)} title="Cooldown Active" onClose={() => {}}>
        <div className="space-y-4">
          <div className="rounded-[24px] border border-[color:var(--border)] bg-[rgba(255,249,242,0.78)] p-4">
            <div className="text-base font-semibold text-[color:var(--text)]">
              {activeCooldown ? `${activeCooldown.lineName} is locked for ${activeCooldown.remainingSeconds}s` : ""}
            </div>
            <div className="mt-2 text-sm text-[color:var(--muted)]">
              After Stop Code or manual terminal close, the SKU stays disabled for {Math.ceil(stopCooldownMs / 1000)} seconds.
              The app also cannot be closed until this timer finishes.
            </div>
          </div>
          <div className="text-right text-sm font-semibold text-[color:var(--accent)]">
            {countdownNow ? `Time left: ${activeCooldown?.remainingSeconds || 0}s` : ""}
          </div>
        </div>
      </Modal>

    </div>
  );
}




