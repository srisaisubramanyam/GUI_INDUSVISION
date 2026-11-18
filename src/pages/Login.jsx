import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Card from "../components/Card.jsx";
import Button from "../components/Button.jsx";
import Input from "../components/Input.jsx";
import { useToast } from "../components/useToast.jsx";
import { Code2, Eye, EyeOff, KeyRound, UserRound } from "lucide-react";
import logo from "../assets/image.png";
import { isAuthed, setSession } from "../utils/auth.js";

const CREDS = {
  client: { username: "hul", password: "hul" },
  developer: { username: "admin", password: "root" },
};

export default function Login() {
  const nav = useNavigate();
  const toast = useToast();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (isAuthed()) {
      const next = localStorage.getItem("role") === "developer" ? "/admin" : "/code";
      nav(next, { replace: true });
    }
  }, [nav]);

  function submit() {
    if (busy) return;
    const u = String(username || "").trim();
    const p = String(password || "");

    if (!u || !p) {
      toast?.push?.("error", "Enter username and password.");
      return;
    }

    const role =
      u === CREDS.developer.username && p === CREDS.developer.password
        ? "developer"
        : u === CREDS.client.username && p === CREDS.client.password
          ? "client"
          : "";

    if (!role) {
      toast?.push?.("error", "Invalid credentials.");
      return;
    }

    setBusy(true);
    try {
      setSession({ role, username: u });
      nav(role === "developer" ? "/admin" : "/code");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="relative min-h-full overflow-hidden p-6">
      <div className="mx-auto flex min-h-full max-w-3xl items-center justify-center">
        <Card className="w-full max-w-3xl">
          <div className="space-y-8">
            <div className="text-center">
              <div className="inline-flex items-center gap-3 rounded-full border border-[color:var(--border)] bg-[rgba(255,249,242,0.76)] px-4 py-2">
                <img alt="Indus Vision" src={logo} className="h-8 w-auto select-none" draggable="false" />
                <div className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-[color:var(--muted)]">
                  HUL Workspace
                </div>
              </div>

              <div className="mt-6 text-[12px] font-extrabold uppercase tracking-[0.18em] text-[color:var(--accent)]">
                Production Access
              </div>
              <div className="mt-3 text-5xl font-black tracking-[-0.05em] text-[color:var(--text)]">
                Sign In
              </div>
              <div className="mx-auto mt-4 max-w-2xl text-lg leading-8 text-[color:var(--muted)]">
                Enter the workspace, manage line controls, and launch production flows from one focused control surface.
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-[26px] border border-[color:var(--border)] bg-[rgba(255,249,242,0.76)] p-5">
                <div className="flex items-center gap-2 text-sm font-semibold text-[color:var(--text)]">
                  <UserRound size={16} className="text-[color:var(--accent-hover)]" />
                  Username
                </div>
                <div className="mt-3">
                  <Input
                    label=""
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="Username"
                    autoComplete="username"
                    onKeyDown={(e) => e.key === "Enter" && submit()}
                  />
                </div>
              </div>

              <div className="rounded-[26px] border border-[color:var(--border)] bg-[rgba(255,249,242,0.76)] p-5">
                <div className="flex items-center gap-2 text-sm font-semibold text-[color:var(--text)]">
                  <KeyRound size={16} className="text-[color:var(--accent-hover)]" />
                  Password
                </div>
                <div className="mt-3">
                  <div className="relative">
                    <input
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Password"
                      autoComplete="current-password"
                      onKeyDown={(e) => e.key === "Enter" && submit()}
                      className="iv-field pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((s) => !s)}
                      aria-label={showPassword ? "Hide password" : "Show password"}
                      className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-2 text-[color:var(--muted)] hover:text-[color:var(--text)] focus:outline-none focus-visible:shadow-[var(--ring)]"
                    >
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <Button className="w-full py-3" disabled={busy} onClick={submit}>
              <Code2 size={16} /> Sign In
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
}
