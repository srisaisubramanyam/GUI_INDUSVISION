import { useEffect, useState } from "react";
import Card from "../components/Card.jsx";
import Button from "../components/Button.jsx";
import Input from "../components/Input.jsx";
import Modal from "../components/Modal.jsx";
import { useToast } from "../components/useToast.jsx";
import { useElectronAPI } from "../utils/electronAPI.js";
import { Plus, Trash2, Video } from "lucide-react";

const isDev = () => localStorage.getItem("role") === "developer";

function asImageSource(base64) {
  const value = String(base64 || "").trim();
  if (!value) return "";
  if (value.startsWith("data:image/")) return value;
  return `data:image/jpeg;base64,${value}`;
}

export default function Camera() {
  const toast = useToast();
  const [cameraCfg, setCameraCfg] = useState(null);
  const [open, setOpen] = useState(false);
  const [cameraName, setCameraName] = useState("");
  const [base64Image, setBase64Image] = useState("");

  async function loadCameraConfig() {
    try {
      const api = await useElectronAPI();
      const cfg = await api.getCameraConfig();
      setCameraCfg(cfg);
    } catch (e) {
      toast.push("error", "Failed to load camera config");
    }
  }

  async function saveCameraConfig(next, successMessage = "Camera config saved") {
    try {
      const api = await useElectronAPI();
      await api.setCameraConfig(next);
      setCameraCfg(next);
      if (successMessage) toast.push("success", successMessage);
      return true;
    } catch (e) {
      toast.push("error", e?.message || "Failed to save camera config");
      return false;
    }
  }

  useEffect(() => {
    loadCameraConfig();
  }, []);

  useEffect(() => {
    const timer = setInterval(() => {
      loadCameraConfig();
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  if (!cameraCfg) return <div className="text-[color:var(--muted)]">Loading...</div>;

  const cameraImageMap = cameraCfg?.cameraImage || {};
  const cameraEntries = Object.entries(cameraImageMap);

  async function addOrUpdateCamera() {
    if (!isDev()) return toast.push("error", "Only developer can add camera");

    const name = cameraName.trim();
    const image = base64Image.trim();
    if (!name) return toast.push("error", "Camera name is required");
    if (!image) return toast.push("error", "Base64 image is required");

    const next = structuredClone(cameraCfg);
    next.cameraImage ??= {};
    next.cameraImage[name] = image;

    const isUpdate = Object.prototype.hasOwnProperty.call(cameraImageMap, name);
    const ok = await saveCameraConfig(next, isUpdate ? "Camera image updated" : "Camera added");
    if (!ok) return;

    setOpen(false);
    setCameraName("");
    setBase64Image("");
  }

  async function removeCamera(name) {
    if (!isDev()) return toast.push("error", "Only developer can remove");

    const next = structuredClone(cameraCfg);
    next.cameraImage ??= {};
    delete next.cameraImage[name];

    await saveCameraConfig(next, "Camera removed");
  }

  return (
    <div className="space-y-6">
      <Card
        title="Cameras"
        right={isDev() ? (
          <Button variant="ghost" onClick={() => setOpen(true)}>
            <Plus size={16} /> Add Camera
          </Button>
        ) : null}
      >
        {/* <div className="text-xs text-slate-400 mb-4">
          Live refresh every 1 second from cameraconfig.
        </div> */}

        <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
          {cameraEntries.map(([name, base64]) => {
            const src = asImageSource(base64);
            return (
              <div
                key={name}
                className="rounded-2xl border border-[color:var(--border)] bg-white/70 p-4 hover:bg-white/90 transition-colors shadow-[0_10px_28px_rgba(11,29,77,0.06)]"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="font-semibold">{name}</div>
                    {/* <div className="mt-1 inline-flex items-center rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[11px] text-emerald-300">
                      Live
                    </div> */}
                  </div>

                  {isDev() && (
                    <button
                      className="p-2 rounded-xl hover:bg-white/80 text-[color:var(--muted)]"
                      onClick={() => removeCamera(name)}
                      title="Remove"
                      type="button"
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>

                <div className="mt-4 rounded-2xl border border-[color:var(--border)] bg-white/55 h-44 flex items-center justify-center text-[color:var(--muted)] overflow-hidden shadow-[inset_0_1px_0_rgba(255,255,255,0.8)]">
                  {src ? (
                    <img
                      src={src}
                      alt={name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <>
                      <Video size={18} />
                      <span className="ml-2 text-sm">No frame data</span>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {cameraEntries.length === 0 && (
          <div className="text-sm text-[color:var(--muted)]">No cameras configured.</div>
        )}
      </Card>

      <Modal open={open} title="Add / Update Camera Base64" onClose={() => setOpen(false)}>
        <div className="space-y-4">
          <Input
            label="Camera Name"
            value={cameraName}
            onChange={(e) => setCameraName(e.target.value)}
            placeholder="machine1"
          />
          <textarea
            value={base64Image}
            onChange={(e) => setBase64Image(e.target.value)}
            placeholder="base64img"
            className="iv-field h-40 resize-none"
          />
          <div className="flex gap-3 justify-end">
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={addOrUpdateCamera}><Plus size={16} /> Save</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
