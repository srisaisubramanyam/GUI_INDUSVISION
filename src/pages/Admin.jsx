import { Navigate, useNavigate } from "react-router-dom";
import { ArrowRight, ShieldCheck, Sliders, Terminal } from "lucide-react";
import Card from "../components/Card.jsx";
import Button from "../components/Button.jsx";
import logo from "../assets/image.png";
import { getSession, isDeveloper } from "../utils/auth.js";

function fmt(ts) {
  if (!ts) return "-";
  try {
    return new Date(ts).toLocaleString();
  } catch {
    return "-";
  }
}

const tiles = [
  {
    title: "Code Runner",
    description: "Configure production lines, manage SKUs, and launch scripts from one place.",
    icon: Terminal,
    cta: "/code",
    button: "Open Workspace",
  },
  {
    title: "System Toggles",
    description: "Control defect checks, behavior flags, and machine-side workflow options.",
    icon: Sliders,
    cta: "/defects",
    button: "Open Controls",
  },
  {
    title: "Profile",
    description: "Review the current session, role access, and jump between user areas quickly.",
    icon: ShieldCheck,
    cta: "/profile",
    button: "Open Profile",
    ghost: true,
  },
];

export default function Admin() {
  const nav = useNavigate();
  const session = getSession();

  if (!isDeveloper()) return <Navigate to="/code" replace />;

  return (
    <div className="space-y-6">
      <div className="grid gap-6 xl:grid-cols-[1.6fr_0.9fr]">
        <Card
          className="min-h-[280px]"
          title={
            <div className="space-y-4">
              <div className="inline-flex items-center gap-3 rounded-full border border-[rgba(113,93,73,0.14)] bg-[rgba(255,248,239,0.74)] px-4 py-2 text-[11px] font-extrabold uppercase tracking-[0.16em] text-[color:var(--muted)]">
                <img alt="Indus Vision" src={logo} className="h-8 w-auto select-none" draggable="false" />
                Admin Workspace
              </div>
              <div>
                <div className="text-5xl font-black leading-none tracking-[-0.04em] text-[color:var(--text)]">
                  Control Center
                </div>
                <div className="mt-3 max-w-2xl text-lg text-[color:var(--muted)]">
                  Manage lines, configure automation behavior, and keep the HUL production workspace organized from one warm, focused dashboard.
                </div>
              </div>
            </div>
          }
          right={null}
        >
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-[24px] border border-[color:var(--border)] bg-[rgba(255,249,242,0.74)] p-5 shadow-[var(--shadow-sm)]">
              <div className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-[color:var(--muted)]">Logged in as</div>
              <div className="mt-3 text-2xl font-extrabold text-[color:var(--text)]">{session.username}</div>
            </div>
            <div className="rounded-[24px] border border-[color:var(--border)] bg-[rgba(255,249,242,0.74)] p-5 shadow-[var(--shadow-sm)]">
              <div className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-[color:var(--muted)]">Role</div>
              <div className="mt-3 text-2xl font-extrabold text-[color:var(--text)]">Developer</div>
            </div>
            <div className="rounded-[24px] border border-[color:var(--border)] bg-[rgba(255,249,242,0.74)] p-5 shadow-[var(--shadow-sm)]">
              <div className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-[color:var(--muted)]">Session time</div>
              <div className="mt-3 text-base font-semibold text-[color:var(--text)]">{fmt(session.loginAt)}</div>
            </div>
          </div>
        </Card>

        <div className="rounded-[30px] border border-[rgba(255,255,255,0.06)] bg-[linear-gradient(180deg,#25211d,#181512)] p-6 text-[#fff6ea] shadow-[0_24px_50px_rgba(22,18,15,0.24)]">
          <div className="flex items-center justify-between gap-3">
            <div className="text-[12px] font-extrabold uppercase tracking-[0.18em] text-[#cdb291]">Workspace Setup</div>
            <div className="text-[12px] font-extrabold uppercase tracking-[0.18em] text-[#7f6a57]">Admin Controls</div>
          </div>
          <div className="mt-6 text-4xl font-black tracking-[-0.04em]">HUL Control</div>
          <div className="mt-4 text-lg leading-8 text-[#e2cfba]">
            Refine the production experience, preview settings instantly, and keep every tool aligned with your operations flow.
          </div>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button onClick={() => nav("/code")} className="!min-w-[156px]">Admin view</Button>
            <Button variant="ghost" onClick={() => nav("/profile")} className="!min-w-[156px] !bg-white/8 !text-[#fff6ea] !border-white/10 hover:!bg-white/12">
              User preview
            </Button>
          </div>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        {tiles.map(({ title, description, icon: Icon, cta, button, ghost }) => (
          <div
            key={title}
            className="rounded-[28px] border border-[color:var(--border)] bg-[linear-gradient(180deg,rgba(248,241,230,0.94),rgba(240,228,210,0.9))] p-5 shadow-[var(--shadow-md)]"
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-[18px] bg-[linear-gradient(180deg,#2b2520,#171411)] text-[#f8eddd] shadow-[0_14px_28px_rgba(22,18,15,0.18)]">
              <Icon size={20} />
            </div>
            <div className="mt-5 text-2xl font-extrabold text-[color:var(--text)]">{title}</div>
            <div className="mt-2 text-[15px] leading-7 text-[color:var(--muted)]">{description}</div>
            <Button
              variant={ghost ? "ghost" : "primary"}
              className="mt-6 w-full justify-between"
              onClick={() => nav(cta)}
            >
              {button}
              <ArrowRight size={16} />
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}
