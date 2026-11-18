import { useEffect, useState } from "react";
import Card from "../components/Card.jsx";
import Button from "../components/Button.jsx";
import Input from "../components/Input.jsx";
import { useToast } from "../components/useToast.jsx";
import { useElectronAPI } from "../utils/electronAPI.js";
const isDev = () => localStorage.getItem("role") === "developer";

export default function DataCollection() {
  const toast = useToast();
  const [cfg, setCfg] = useState(null);
  const [skuName, setSkuName] = useState("");
  const [outputDir, setOutputDir] = useState("C:\\data\\collection");
  const [scriptPath, setScriptPath] = useState("C:/Users/Rupesh/dummypythonfiles/infinite_counter.py");
  const [isRunning, setIsRunning] = useState(false);

  async function load() {
    try {
      const api = await useElectronAPI();
      const c = await api.getConfig();
      setCfg(c);
      setOutputDir(c?.dataCollection?.outputDir || "C:\\data\\collection");
      setSkuName(c?.dataCollection?.sku_name || "");
      setScriptPath(c?.dataCollection?.scriptPath || "C:/Users/Rupesh/dummypythonfiles/infinite_counter.py");
    } catch (e) {
      toast.push("error", "Failed to load config");
    }
  }

  async function save(next, successMessage = "Saved to config file") {
    try {
      const api = await useElectronAPI();
      await api.setConfig(next);
      setCfg(next);
      if (successMessage) toast.push("success", successMessage);
      return true;
    } catch (e) {
      toast.push("error", e?.message || "Failed to save");
      return false;
    }
  }

  useEffect(() => {
    load();
  }, []);

  // Sync the button with the real process state from the main process, so a run
  // resumed after an app / system restart (or a terminal closed manually) shows correctly.
  useEffect(() => {
    let cancelled = false;
    let unsubscribe;

    (async () => {
      try {
        const api = await useElectronAPI();
        const snapshot = await api.getRunState();
        if (!cancelled && snapshot) {
          setIsRunning(Boolean(snapshot.running?.dataCollection?.running));
        }

        unsubscribe = api.onRunState((payload) => {
          if (payload?.lineName !== "dataCollection") return;
          setIsRunning(Boolean(payload?.running));
        });
      } catch (e) {
        // Ignore in non-electron environments.
      }
    })();

    return () => {
      cancelled = true;
      if (typeof unsubscribe === "function") unsubscribe();
    };
  }, []);

  if (!cfg) return <div className="text-[color:var(--muted)]">Loading...</div>;

  async function saveOutputDir(nextOutputDir) {
    const trimmed = String(nextOutputDir || "").trim();
    if (!trimmed) {
      toast.push("error", "Output directory required");
      return false;
    }

    // Convert Windows path to Python-style path
    const pythonPath = trimmed.replace(/\\/g, '/');

    const next = structuredClone(cfg);
    next.dataCollection ??= {};
    next.dataCollection.outputDir = trimmed;
    next.dataCollection.pythonPath = `c:${pythonPath}`;
    const ok = await save(next, "Output directory updated");
    if (ok) setOutputDir(trimmed);
    return ok;
  }

  async function saveSkuName(nextSkuName) {
    const trimmed = String(nextSkuName || "").trim();
    if (!trimmed) {
      toast.push("error", "SKU Name required");
      return false;
    }

    const next = structuredClone(cfg);
    next.dataCollection ??= {};
    next.dataCollection.sku_name = trimmed;
    const ok = await save(next, "SKU Name saved");
    if (ok) setSkuName(trimmed);
    return ok;
  }

  async function startRun() {
    if (!skuName.trim() || !outputDir.trim()) {
      toast.push("error", "SKU Name and Path are required to run");
      return;
    }

    try {
      const api = await useElectronAPI();
      const res = await api.runPython({
        scriptPath: scriptPath,
        lineName: "dataCollection",
        ocrConfig: {},
        skuLabel: skuName
      });

      if (!res?.ok) {
        toast.push("error", res?.message || "Failed to run script");
        return;
      }

      const next = structuredClone(cfg);
      next.dataCollection ??= {};
      next.dataCollection.runEnabled = true;
      await save(next, "Data collection started");
      setIsRunning(true);
    } catch (e) {
      toast.push("error", e?.message || "Failed to start data collection");
    }
  }

  async function stopRun() {
    try {
      const api = await useElectronAPI();
      const res = await api.stopPython({ lineName: "dataCollection" });

      if (res?.ok && res?.stopped) {
        const next = structuredClone(cfg);
        next.dataCollection ??= {};
        next.dataCollection.runEnabled = false;
        await save(next, "Data collection stopped");
        setIsRunning(false);
        return;
      }

      if (res?.cooldownActive) {
        toast.push("info", res?.message || "Cooldown active, please wait");
        return;
      }

      toast.push("info", res?.message || "No running process for data collection");
    } catch (e) {
      toast.push("error", e?.message || "Failed to stop data collection");
    }
  }

  async function browseOutputDir() {
    if (!isDev()) return toast.push("error", "Only developer can update output directory");

    try {
      const api = await useElectronAPI();
      const result = await api.selectDirectory({ defaultPath: outputDir });
      if (result?.canceled || !result?.filePath) return;
      await saveOutputDir(result.filePath);
    } catch (e) {
      toast.push("error", e?.message || "Failed to browse path");
    }
  }

  async function saveOutputDirWithConfig(nextOutputDir) {
    const trimmed = String(nextOutputDir || "").trim();
    if (!trimmed) {
      toast.push("error", "Output directory required");
      return false;
    }

    const pythonPath = trimmed.replace(/\\/g, '/');
    const next = structuredClone(cfg);
    next.dataCollection ??= {};
    next.dataCollection.outputDir = trimmed;
    next.dataCollection.pythonPath = `c:${pythonPath}`;
    const ok = await save(next, "Output directory updated");
    if (ok) setOutputDir(trimmed);
    return ok;
  }

  return (
    <div className="space-y-6">
      <Card title="Data Collection">
        <div className="space-y-4">
          {/* SKU Name Section */}
          <div className="rounded-2xl border border-[color:var(--border)] bg-white/65 p-4 shadow-[0_10px_28px_rgba(11,29,77,0.06)]">
            <div className="grid gap-3 md:grid-cols-[1fr_auto]">
              <Input
                label="SKU Name"
                value={skuName}
                onChange={(e) => setSkuName(e.target.value)}
                placeholder="Enter SKU name..."
              />
              <div className="md:flex md:items-end">
                <Button onClick={() => saveSkuName(skuName)}>
                  Save Name
                </Button>
              </div>
            </div>
          </div>

          {/* Output Directory Section */}
          {isDev() && (
            <div className="rounded-2xl border border-[color:var(--border)] bg-white/65 p-4 shadow-[0_10px_28px_rgba(11,29,77,0.06)]">
              <div className="grid gap-3 md:grid-cols-[1fr_auto_auto] md:items-end">
                <Input
                  label="Browse Path"
                  value={outputDir}
                  onChange={(e) => setOutputDir(e.target.value)}
                  placeholder=""
                />
                <Button variant="ghost" onClick={browseOutputDir}>
                  Browse
                </Button>
                <Button onClick={() => saveOutputDirWithConfig(outputDir)}>
                  Save Path
                </Button>
              </div>
            </div>
          )}

          {/* Script Path Display */}
          <div className="rounded-2xl border border-[color:var(--border)] bg-white/65 p-4 shadow-[0_10px_28px_rgba(11,29,77,0.06)]">
            <div className="space-y-2">
              <label className="block text-sm font-medium">Script Path</label>
              <div className="text-sm text-[color:var(--muted)] font-mono break-all p-2 rounded bg-white/50">
                {scriptPath}
              </div>
            </div>
          </div>

          {/* Run Button */}
          <div className="rounded-2xl border border-[color:var(--border)] bg-white/65 p-4 shadow-[0_10px_28px_rgba(11,29,77,0.06)]">
            <div className="flex items-center justify-between gap-4">
              <div>
                <div className="font-semibold">Run Data Collection</div>
                <div className="text-xs text-[color:var(--muted)] mt-1">
                  Status: {isRunning ? "RUNNING" : "STOPPED"}
                </div>
                {(!skuName.trim() || !outputDir.trim()) && (
                  <div className="text-xs text-orange-600 mt-2">
                    ⚠ Enter SKU Name and Path to enable
                  </div>
                )}
              </div>
              <Button
                onClick={isRunning ? stopRun : startRun}
                className={skuName.trim() && outputDir.trim() ? "ring-2 ring-yellow-400 ring-offset-2" : ""}
                disabled={!skuName.trim() || !outputDir.trim()}
              >
                {isRunning ? "Stop Run" : "Start Run"}
              </Button>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}
