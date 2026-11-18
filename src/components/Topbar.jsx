import { User } from "lucide-react";
import nulLogo from "../assets/nul_logo.png";
import { getSession } from "../utils/auth.js";

export default function Topbar() {
  const session = getSession();
  const role = session.role || "client";
  const roleLabel = role === "developer" ? "Developer" : "Client";

  return (
    <header className="relative flex h-24 items-center justify-between border-b border-[color:var(--border)] bg-[rgba(248,241,230,0.82)] px-6 backdrop-blur-md">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(255,255,255,0.55),transparent_32%)]" />

      <div className="relative z-10 flex items-center gap-3 rounded-[24px] border border-white/10 bg-[linear-gradient(180deg,#28231f,#181513)] px-4 py-3 shadow-[0_14px_36px_rgba(22,18,15,0.22)]">
        <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-white/5">
          <User size={17} className="text-[#f7ebda]" />
        </div>
        <div className="leading-tight">
          <div className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#cbb08e]">Workspace</div>
          <div className="text-sm font-semibold text-[#fff6ea]">
            {roleLabel} mode{session.username ? ` - ${session.username}` : ""}
          </div>
        </div>
      </div>

      <div className="relative z-10 flex items-center">
        <div className="rounded-[26px] border border-[rgba(113,93,73,0.14)] bg-[rgba(255,250,244,0.92)] px-6 py-3 shadow-[0_14px_30px_rgba(93,63,46,0.10)]">
          <img
            src={nulLogo}
            alt="NUL Logo"
            draggable="false"
            className="max-h-14 w-auto object-contain select-none"
          />
        </div>
      </div>
    </header>
  );
}
