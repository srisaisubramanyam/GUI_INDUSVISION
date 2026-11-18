import { useEffect, useMemo, useState } from "react";
import Card from "../components/Card.jsx";
import Button from "../components/Button.jsx";
import Input from "../components/Input.jsx";
import Select from "../components/Select.jsx";
import Modal from "../components/Modal.jsx";
import { useToast } from "../components/useToast.jsx";
import { useElectronAPI } from "../utils/electronAPI.js";
import { Edit3, RefreshCw, Save, Trash2 } from "lucide-react";

const isDev = () => localStorage.getItem("role") === "developer";
const DEFAULT_IMAGE_PATH = "C:\\Users\\Rupesh\\demoprojects\\configs_Gui\\vaseline images\\back cam";
const DEFAULT_PLC_IP = "0.0.0.0";

function safeTrim(value) {
  return String(value ?? "").trim();
}

export default function Diagnosis() {
  const toast = useToast();

  const [cfg, setCfg] = useState(null);
  const [cameraCfg, setCameraCfg] = useState(null);
  const [diagnosisMappings, setDiagnosisMappingsState] = useState(null);
  const [diagnosisPlcCfg, setDiagnosisPlcCfg] = useState(null);

  const [line, setLine] = useState("");
  const [camera, setCamera] = useState("");
  const [pathDraft, setPathDraft] = useState("");
  const [selectionTouched, setSelectionTouched] = useState(false);

  const [imagesLoading, setImagesLoading] = useState(false);
  const [imagesError, setImagesError] = useState("");
  const [images, setImages] = useState([]);
  const [preview, setPreview] = useState(null);

  const [plcEditing, setPlcEditing] = useState(false);
  const [plcIpDraft, setPlcIpDraft] = useState(DEFAULT_PLC_IP);
  const [plcActionsDraft, setPlcActionsDraft] = useState({
    ping: false,
    rejection: false,
    heartbeat: false
  });

  function formatIpLike(raw) {
    const v = String(raw ?? "");
    const cleaned = v.replace(/[^\d.]/g, "");
    const parts = cleaned.split(".").slice(0, 4).map((p) => p.replace(/\D/g, "").slice(0, 3));
    return parts.join(".");
  }

  function onIpChange(nextRaw) {
    setPlcIpDraft((prev) => {
      const prevStr = String(prev ?? "");
      const deleting = String(nextRaw ?? "").length < prevStr.length;
      const formatted = formatIpLike(nextRaw);
      if (deleting) return formatted;

      const segs = formatted.split(".");
      const last = segs[segs.length - 1] ?? "";
      if (segs.length < 4 && last.length === 3 && !formatted.endsWith(".")) {
        return `${formatted}.`;
      }
      return formatted;
    });
  }

  const lineKeys = useMemo(() => Object.keys(cfg?.code?.lines || {}), [cfg]);
  const cameraKeys = useMemo(() => Object.keys(cameraCfg?.cameraImage || {}), [cameraCfg]);

  const savedPath = diagnosisMappings?.mappings?.[line]?.[camera] || "";
  const activePath = safeTrim(pathDraft) || safeTrim(savedPath);

  async function loadAll() {
    try {
      const api = await useElectronAPI();
      const [nextCfg, nextCameraCfg, nextMappings, nextPlcCfg] = await Promise.all([
        api.getConfig(),
        api.getCameraConfig(),
        api.getDiagnosisMappings(),
        api.getDiagnosisConfig()
      ]);

      setCfg(nextCfg);
      setCameraCfg(nextCameraCfg);
      setDiagnosisMappingsState(nextMappings);
      setDiagnosisPlcCfg(nextPlcCfg);

      const ip = safeTrim(nextPlcCfg?.plc?.ipAddress) || DEFAULT_PLC_IP;
      setPlcIpDraft(ip);
      setPlcActionsDraft({
        ping: String(nextPlcCfg?.click_status?.ping || "").toLowerCase() === "triggered",
        rejection: String(nextPlcCfg?.click_status?.rejection || "").toLowerCase() === "triggered",
        heartbeat: String(nextPlcCfg?.click_status?.heartbeat || "").toLowerCase() === "triggered"
      });
    } catch (e) {
      toast.push("error", "Failed to load diagnosis configuration");
    }
  }

  async function saveDiagnosisMappings(next, successMessage) {
    try {
      const api = await useElectronAPI();
      await api.setDiagnosisMappings(next);
      setDiagnosisMappingsState(next);
      if (successMessage) toast.push("success", successMessage);
      return true;
    } catch (e) {
      toast.push("error", e?.message || "Failed to save diagnosis mappings");
      return false;
    }
  }

  useEffect(() => {
    loadAll();
  }, []);

  useEffect(() => {
    if (!line && lineKeys.length > 0) setLine(lineKeys[0]);
    if (line && !lineKeys.includes(line)) setLine(lineKeys[0] || "");
  }, [lineKeys, line]);

  useEffect(() => {
    if (!camera && cameraKeys.length > 0) setCamera(cameraKeys[0]);
    if (camera && !cameraKeys.includes(camera)) setCamera(cameraKeys[0] || "");
  }, [cameraKeys, camera]);

  useEffect(() => {
    if (!diagnosisMappings) return;
    const next = diagnosisMappings?.mappings?.[line]?.[camera] || "";
    setPathDraft(next);
    setImages([]);
    setImagesError("");
  }, [diagnosisMappings, line, camera]);

  useEffect(() => {
    if (plcEditing) return;
    const ip = safeTrim(diagnosisPlcCfg?.plc?.ipAddress) || DEFAULT_PLC_IP;
    setPlcIpDraft(ip);
    setPlcActionsDraft({
      ping: String(diagnosisPlcCfg?.click_status?.ping || "").toLowerCase() === "triggered",
      rejection: String(diagnosisPlcCfg?.click_status?.rejection || "").toLowerCase() === "triggered",
      heartbeat: String(diagnosisPlcCfg?.click_status?.heartbeat || "").toLowerCase() === "triggered"
    });
  }, [diagnosisPlcCfg, plcEditing]);

  useEffect(() => {
    if (!selectionTouched) return;
    const pathToLoad = isDev() ? activePath : safeTrim(savedPath);
    if (!pathToLoad) {
      setImages([]);
      setImagesError(isDev() ? "No image path configured." : "No images mapped for this line/camera. Ask developer.");
      return;
    }
    refreshImages(pathToLoad);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectionTouched, line, camera, savedPath]);

  async function refreshImages(dirPath) {
    const cleaned = safeTrim(dirPath);
    if (!cleaned) {
      setImages([]);
      setImagesError("No image path configured.");
      return;
    }

    setImagesLoading(true);
    setImagesError("");
    try {
      const api = await useElectronAPI();
      const res = await api.listDiagnosisImages({ dirPath: cleaned, limit: 24 });
      if (!res?.ok) {
        setImages([]);
        setImagesError(res?.message || "Failed to load images");
        return;
      }
      setImages(Array.isArray(res.images) ? res.images : []);
    } catch (e) {
      setImages([]);
      setImagesError(e?.message || "Failed to load images");
    } finally {
      setImagesLoading(false);
    }
  }

  async function saveMapping() {
    if (!isDev()) return toast.push("error", "Only developer can edit mappings");

    const lineName = safeTrim(line);
    const cameraName = safeTrim(camera);
    const imagePath = safeTrim(pathDraft);
    if (!lineName) return toast.push("error", "Select a line");
    if (!cameraName) return toast.push("error", "Select a camera");
    if (!imagePath) return toast.push("error", "Image path is required");

    const next = structuredClone(diagnosisMappings || {});
    next.mappings ??= {};
    next.mappings[lineName] ??= {};
    next.mappings[lineName][cameraName] = imagePath;

    const ok = await saveDiagnosisMappings(next, "Diagnosis mapping saved");
    if (ok) refreshImages(imagePath);
  }

  async function clearMapping() {
    if (!isDev()) return toast.push("error", "Only developer can edit mappings");
    const lineName = safeTrim(line);
    const cameraName = safeTrim(camera);
    if (!lineName || !cameraName) return;
    if (!diagnosisMappings?.mappings?.[lineName]?.[cameraName]) return;

    const next = structuredClone(diagnosisMappings);
    delete next.mappings?.[lineName]?.[cameraName];
    if (next.mappings?.[lineName] && Object.keys(next.mappings[lineName]).length === 0) {
      delete next.mappings[lineName];
    }
    const ok = await saveDiagnosisMappings(next, "Mapping cleared");
    if (ok) {
      setPathDraft("");
      setImages([]);
    }
  }

  function startPlcEdit() {
    const ip = safeTrim(diagnosisPlcCfg?.plc?.ipAddress) || DEFAULT_PLC_IP;
    setPlcIpDraft(ip);
    setPlcActionsDraft({
      ping: String(diagnosisPlcCfg?.click_status?.ping || "").toLowerCase() === "triggered",
      rejection: String(diagnosisPlcCfg?.click_status?.rejection || "").toLowerCase() === "triggered",
      heartbeat: String(diagnosisPlcCfg?.click_status?.heartbeat || "").toLowerCase() === "triggered"
    });
    setPlcEditing(true);
  }

  function cancelPlcEdit() {
    const ip = safeTrim(diagnosisPlcCfg?.plc?.ipAddress) || DEFAULT_PLC_IP;
    setPlcIpDraft(ip);
    setPlcActionsDraft({
      ping: String(diagnosisPlcCfg?.click_status?.ping || "").toLowerCase() === "triggered",
      rejection: String(diagnosisPlcCfg?.click_status?.rejection || "").toLowerCase() === "triggered",
      heartbeat: String(diagnosisPlcCfg?.click_status?.heartbeat || "").toLowerCase() === "triggered"
    });
    setPlcEditing(false);
  }

  async function submitPlc() {
    if (!plcEditing) return;
    const ipAddress = safeTrim(plcIpDraft) || DEFAULT_PLC_IP;

    const click_status = {
      ping: plcActionsDraft.ping ? "triggered" : "non-triggered",
      rejection: plcActionsDraft.rejection ? "triggered" : "non-triggered",
      heartbeat: plcActionsDraft.heartbeat ? "triggered" : "non-triggered"
    };

    const next = {
      plc: { ipAddress },
      click_status
    };

    try {
      const api = await useElectronAPI();
      await api.setDiagnosisConfig(next);
      const refreshed = await api.getDiagnosisConfig();
      setDiagnosisPlcCfg(refreshed);
      setPlcEditing(false);

      const rs = refreshed?.response_status || {};
      const items = [
        { key: "ping", label: "Ping", value: String(rs.ping || "").toUpperCase() || "NOK" },
        { key: "rejection", label: "Rejection", value: String(rs.rejection || "").toUpperCase() || "NOK" },
        { key: "heartbeat", label: "Heartbeat", value: String(rs.heartbeat || "").toUpperCase() || "NOK" }
      ];
      for (const it of items) {
        toast.push(it.value === "OK" ? "success" : "error", `${it.label}: ${it.value}`);
      }
    } catch (e) {
      toast.push("error", e?.message || "Failed to save PLC settings");
    }
  }

  function togglePlcActionDraft(actionName) {
    if (!plcEditing) return;
    setPlcActionsDraft((prev) => ({ ...prev, [actionName]: !Boolean(prev?.[actionName]) }));
  }

  const pingTriggered = plcEditing
    ? Boolean(plcActionsDraft.ping)
    : String(diagnosisPlcCfg?.click_status?.ping || "").toLowerCase() === "triggered";
  const rejectionTriggered = plcEditing
    ? Boolean(plcActionsDraft.rejection)
    : String(diagnosisPlcCfg?.click_status?.rejection || "").toLowerCase() === "triggered";
  const heartbeatTriggered = plcEditing
    ? Boolean(plcActionsDraft.heartbeat)
    : String(diagnosisPlcCfg?.click_status?.heartbeat || "").toLowerCase() === "triggered";

  function StatusPill({ triggered }) {
    return (
      <div className="flex items-center gap-2">
        <span
          className={`inline-block h-2.5 w-2.5 rounded-full ${triggered ? "bg-emerald-500" : "bg-slate-300"}`}
        />
        <span className={`text-sm ${triggered ? "text-emerald-700 font-semibold" : "text-slate-500"}`}>
          {triggered ? "Triggered" : "Non-triggered"}
        </span>
      </div>
    );
  }

  if (!cfg || !cameraCfg || !diagnosisMappings || !diagnosisPlcCfg) {
    return <div className="text-[color:var(--muted)]">Loading...</div>;
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card
        title="Line / Camera Images"
        right={isDev() ? (
          <div className="flex gap-2">
            <Button
              variant="ghost"
              onClick={() => refreshImages(activePath)}
              disabled={imagesLoading}
              title="Reload images from path"
            >
              <RefreshCw size={16} /> Refresh
            </Button>
            <Button variant="ghost" onClick={saveMapping} title="Save mapping to diagnosis.json">
              <Save size={16} /> Save
            </Button>
          </div>
        ) : null}
      >
        <div className="grid gap-4 md:grid-cols-2">
          <Select
            label="Choose Line"
            value={line}
            onChange={(e) => {
              setLine(e.target.value);
              setSelectionTouched(true);
            }}
          >
            {lineKeys.length === 0 ? (
              <option value="">No lines</option>
            ) : (
              lineKeys.map((x) => <option key={x} value={x}>{x}</option>)
            )}
          </Select>

          <Select
            label="Choose Camera"
            value={camera}
            onChange={(e) => {
              setCamera(e.target.value);
              setSelectionTouched(true);
            }}
          >
            {cameraKeys.length === 0 ? (
              <option value="">No cameras</option>
            ) : (
              cameraKeys.map((x) => <option key={x} value={x}>{x}</option>)
            )}
          </Select>
        </div>

        {isDev() && (
          <div className="mt-4 grid gap-3 md:grid-cols-[1fr_auto] items-end">
            <Input
              label="Images Path"
              value={pathDraft}
              onChange={(e) => setPathDraft(e.target.value)}
              placeholder={DEFAULT_IMAGE_PATH}
            />

            <div className="flex gap-2">
              <Button variant="danger" onClick={clearMapping} disabled={!savedPath} title="Clear saved mapping for this line/camera">
                <Trash2 size={16} />
              </Button>
            </div>
          </div>
        )}

        <div className="mt-5">
          {!selectionTouched && (
            <div className="text-sm text-[color:var(--muted)]">
              Select a line and camera to view images.
            </div>
          )}

          {imagesError && (
            <div className="text-sm text-red-600">{imagesError}</div>
          )}

          {imagesLoading && (
            <div className="text-sm text-[color:var(--muted)]">Loading images…</div>
          )}

          {selectionTouched && !imagesLoading && !imagesError && images.length === 0 && (
            <div className="text-sm text-[color:var(--muted)]">No images found (showing up to 24).</div>
          )}

          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
            {images.map((img) => (
              <button
                key={`${img.fullPath || img.name}`}
                type="button"
                onClick={() => setPreview(img)}
                className="text-left rounded-2xl border border-[color:var(--border)] bg-white/70 overflow-hidden hover:bg-white/90 transition-colors shadow-[0_10px_28px_rgba(11,29,77,0.06)]"
                title="Click to preview"
              >
                <div className="h-28 bg-slate-50">
                  <img src={img.dataUrl} alt={img.name} className="w-full h-full object-cover" />
                </div>
                {isDev() && (
                  <div className="p-2 text-[11px] text-slate-700 truncate">{img.name}</div>
                )}
              </button>
            ))}
          </div>
        </div>
      </Card>

      <Card
        title="PLC"
        right={(
          <div className="flex gap-2">
            <Button
              className="!rounded-xl !px-4"
              variant="secondary"
              onClick={() => (plcEditing ? cancelPlcEdit() : startPlcEdit())}
              title={plcEditing ? "Cancel editing" : "Edit PLC fields"}
            >
              <Edit3 size={16} /> Edit
            </Button>
            <Button
              className="!rounded-xl !px-4"
              onClick={submitPlc}
              disabled={!plcEditing}
              title="Save PLC fields"
            >
              <Save size={16} /> Submit
            </Button>
          </div>
        )}
      >
        <div className="rounded-3xl border border-[color:var(--border)] bg-sky-50/60 p-4 shadow-[0_14px_30px_rgba(11,29,77,0.06)]">
          <div className="text-sm text-slate-700 mb-4">
            Ping response: <span className="font-semibold">{String(diagnosisPlcCfg?.response_status?.ping || "OK")}</span>
          </div>

          <div className="space-y-3">
            <div className="rounded-2xl border border-[color:var(--border)] bg-white/75 p-3">
              <div className="grid grid-cols-[110px_1fr_auto] items-center gap-3">
                <Button
                  className="!w-[110px] !justify-center !rounded-xl"
                  variant="primary"
                  onClick={() => togglePlcActionDraft("ping")}
                  disabled={!plcEditing}
                  title="Toggle ping trigger (Edit required)"
                >
                  Ping
                </Button>
                <input
                  value={plcIpDraft}
                  onChange={(e) => onIpChange(e.target.value)}
                  placeholder={DEFAULT_PLC_IP}
                  disabled={!plcEditing}
                  inputMode="numeric"
                  className="iv-field !py-2"
                />
                <StatusPill triggered={pingTriggered} />
              </div>
            </div>

            <div className="rounded-2xl border border-[color:var(--border)] bg-white/75 p-3">
              <div className="grid grid-cols-[110px_1fr_auto] items-center gap-3">
                <Button
                  className="!w-[110px] !justify-center !rounded-xl"
                  variant="primary"
                  onClick={() => togglePlcActionDraft("rejection")}
                  disabled={!plcEditing}
                  title="Toggle rejection trigger (Edit required)"
                >
                  Rejection
                </Button>
                <div />
                <StatusPill triggered={rejectionTriggered} />
              </div>
            </div>

            <div className="rounded-2xl border border-[color:var(--border)] bg-white/75 p-3">
              <div className="grid grid-cols-[110px_1fr_auto] items-center gap-3">
                <Button
                  className="!w-[110px] !justify-center !rounded-xl"
                  variant="primary"
                  onClick={() => togglePlcActionDraft("heartbeat")}
                  disabled={!plcEditing}
                  title="Toggle heartbeat trigger (Edit required)"
                >
                  Heartbeat
                </Button>
                <div />
                <StatusPill triggered={heartbeatTriggered} />
              </div>
            </div>
          </div>
        </div>
      </Card>

      <Modal
        open={Boolean(preview)}
        title={isDev() ? (preview?.name || "Image Preview") : "Image Preview"}
        onClose={() => setPreview(null)}
      >
        {preview && (
          <div className="space-y-3">
            <div className="rounded-2xl border border-[color:var(--border)] bg-white/60 overflow-hidden">
              <img src={preview.dataUrl} alt={preview.name} className="w-full max-h-[60vh] object-contain bg-slate-50" />
            </div>
            {isDev() && (
              <div className="text-xs text-[color:var(--muted)] break-all">
                {preview.fullPath || ""}
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
