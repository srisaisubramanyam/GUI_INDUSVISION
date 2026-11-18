import { useEffect, useState } from "react";
import Card from "../components/Card.jsx";
import Button from "../components/Button.jsx";
import Input from "../components/Input.jsx";
import Modal from "../components/Modal.jsx";
import { useToast } from "../components/useToast.jsx";
import { useElectronAPI } from "../utils/electronAPI.js";
import { Plus, ShieldCheck, Trash2 } from "lucide-react";
import { useNavigate } from "react-router-dom";

const isDev = () => localStorage.getItem("role") === "developer";

export default function DefectToggles() {
  const toast = useToast();
  const nav = useNavigate();
  const [cfg, setCfg] = useState(null);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");

  const [authed, setAuthed] = useState(() => isDev());
  const [authOpen, setAuthOpen] = useState(() => !isDev());
  const [authUser, setAuthUser] = useState("");
  const [authPass, setAuthPass] = useState("");
  const [authErr, setAuthErr] = useState("");

  async function load() {
    try {
      const api = await useElectronAPI();
      const c = await api.getConfig();
      setCfg(c);
    } catch (e) {
      console.error(e);
      toast.push("error", "Failed to load config");
    }
  }

  async function save(next) {
    try {
      const api = await useElectronAPI();
      await api.setConfig(next);
      setCfg(next);
      toast.push("success", "Saved to config file");
    } catch (e) {
      toast.push("error", e?.message || "Failed to save");
    }
  }

  useEffect(() => {
    if (!authed) return;
    load();
  }, [authed]);

  const items = cfg?.defectToggles?.items || [];

  function closeAuth() {
    setAuthOpen(false);
    nav("/code");
  }

  function submitAuth(e) {
    e?.preventDefault?.();

    const u = authUser.trim().toLowerCase();
    const p = authPass;

    if (u === "hul" && p === "hul") {
      setAuthErr("");
      setAuthed(true);
      setAuthOpen(false);
      setAuthUser("");
      setAuthPass("");
      toast.push("success", "Authenticated");
      return;
    }

    setAuthErr("Invalid username or password.");
    setAuthPass("");
    toast.push("error", "Invalid credentials");
  }

  async function toggle(id) {
    // ✅ client is allowed to click toggle UI, but saving is blocked by main for non-dev
    const next = structuredClone(cfg);
    next.defectToggles.items = next.defectToggles.items.map(x =>
      x.id === id ? { ...x, enabled: !x.enabled } : x
    );
    await save(next);
  }

  async function addItem() {
    if (!name.trim()) return toast.push("error", "Name required");
    if (!isDev()) return toast.push("error", "Only developer can add");

    const next = structuredClone(cfg);
    next.defectToggles ??= { items: [] };
    next.defectToggles.items ??= [];

    next.defectToggles.items.push({
      id: `def_${Date.now()}`,
      name: name.trim(),
      enabled: true
    });

    await save(next);
    setOpen(false);
    setName("");
  }

  async function removeItem(id) {
    if (!isDev()) return toast.push("error", "Only developer can remove");
    const next = structuredClone(cfg);
    next.defectToggles.items = next.defectToggles.items.filter(x => x.id !== id);
    await save(next);
  }

  if (!authed) {
    return (
      <div className="min-h-[240px]">
        <Modal open={authOpen} title="Defect Toggles Access" onClose={closeAuth}>
          <form onSubmit={submitAuth} className="space-y-4">
            <div className="flex items-start gap-3 rounded-2xl border border-[color:var(--border)] bg-gradient-to-r from-[rgba(11,29,77,0.06)] to-[rgba(62,163,107,0.06)] p-4">
              <div className="h-10 w-10 rounded-2xl bg-gradient-to-br from-[#0b1d4d] to-[#12306f] text-white flex items-center justify-center shadow-[0_10px_24px_rgba(11,29,77,0.22)]">
                <ShieldCheck size={18} />
              </div>
              <div className="leading-snug">
                <div className="font-semibold">Client authentication required</div>
                <div className="text-sm text-[color:var(--muted)] mt-1">
                  Enter your credentials to view Defect Toggles.
                </div>
              </div>
            </div>

            <div className="grid gap-4">
              <Input
                label="Username"
                value={authUser}
                onChange={(e) => setAuthUser(e.target.value)}
                placeholder="Enter username"
                autoFocus
              />
              <Input
                label="Password"
                type="password"
                value={authPass}
                onChange={(e) => setAuthPass(e.target.value)}
                placeholder="Enter password"
              />
            </div>

            {authErr && (
              <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-2 text-sm text-red-700">
                {authErr}
              </div>
            )}

            <div className="flex justify-end gap-3">
              <Button variant="ghost" type="button" onClick={closeAuth}>Cancel</Button>
              <Button variant="secondary" type="submit">Continue</Button>
            </div>
          </form>
        </Modal>
      </div>
    );
  }

  if (!cfg) return <div className="text-[color:var(--muted)]">Loading...</div>;

  return (
    <div className="space-y-6">
      <Card
        title="Defect Toggles"
        right={isDev() ? (
          <Button variant="ghost" onClick={() => setOpen(true)}>
            <Plus size={16} /> Add Toggle
          </Button>
        ) : null}
      >
        <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
          {items.map(x => (
            <div key={x.id} className="rounded-2xl border border-[color:var(--border)] bg-white/65 p-4 shadow-[0_10px_28px_rgba(11,29,77,0.06)]">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-semibold">{x.name}</div>
                  <div className="text-xs text-[color:var(--muted)] mt-1">
                    Status: {x.enabled ? "ON" : "OFF"}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => toggle(x.id)}
                    className={`iv-switch ${x.enabled ? "iv-switch--on" : ""}`}
                    title="Toggle & Save"
                    type="button"
                  >
                    <span className="iv-switch-thumb" />
                  </button>

                  {isDev() && (
                    <button
                      className="p-2 rounded-xl hover:bg-white/80 text-[color:var(--muted)]"
                      onClick={() => removeItem(x.id)}
                      title="Remove"
                      type="button"
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>

        {items.length === 0 && (
          <div className="text-sm text-[color:var(--muted)]">No defect toggles configured.</div>
        )}
      </Card>

      <Modal open={open} title="Add Defect Toggle" onClose={() => setOpen(false)}>
        <div className="space-y-4">
          <Input
            label="Toggle Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Scratch / Dent / Crack..."
          />
          <div className="flex justify-end gap-3">
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={addItem}><Plus size={16} /> Add</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
