import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { CircleUser, LogOut } from "lucide-react";
import Card from "../components/Card.jsx";
import Button from "../components/Button.jsx";
import { clearSession, getSession } from "../utils/auth.js";

function fmt(ts) {
  if (!ts) return "-";
  try {
    return new Date(ts).toLocaleString();
  } catch {
    return "-";
  }
}

export default function Profile() {
  const nav = useNavigate();
  const session = useMemo(() => getSession(), []);
  const roleLabel = session.role === "developer" ? "Developer" : "Client";

  return (
    <div className="space-y-6">
      <Card
        title={
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-[18px] bg-[linear-gradient(180deg,#25201b,#141210)] text-[#f7ebda] shadow-[0_12px_24px_rgba(22,18,15,0.18)]">
              <CircleUser size={20} />
            </div>
            <div>
              <div className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-[color:var(--muted)]">User Session</div>
              <div className="text-2xl font-extrabold text-[color:var(--text)]">Profile</div>
            </div>
          </div>
        }
        right={
          <Button
            variant="danger"
            className="px-5 py-3"
            onClick={() => {
              clearSession();
              nav("/");
            }}
          >
            <LogOut size={16} />
            Logout
          </Button>
        }
      >
        <div className="grid gap-5 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="rounded-[28px] border border-[color:var(--border)] bg-[rgba(255,249,242,0.72)] p-6 shadow-[var(--shadow-sm)]">
            {/* <div className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-[color:var(--muted)]">Signed in as</div> */}
            {/* <div className="mt-4 text-4xl font-black tracking-[-0.04em] text-[color:var(--text)]">
              {session.username || "-"}
            </div> */}
            <div className="mt-3 inline-flex rounded-full border border-[color:var(--border)] bg-[rgba(248,239,226,0.92)] px-4 py-2 text-sm font-semibold text-[color:var(--text)]">
              {roleLabel} workspace access
            </div>
          </div>

          <div className="rounded-[28px] border border-[color:var(--border)] bg-[linear-gradient(180deg,#25211d,#181512)] p-6 text-[#fff6ea] shadow-[0_24px_50px_rgba(22,18,15,0.22)]">
            <div className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-[#cdb291]">Session details</div>
            <div className="mt-4 text-lg font-semibold">{fmt(session.loginAt)}</div>
            <div className="mt-2 text-sm leading-7 text-[#e2cfba]">
              Your login time is stored locally for this application session so you can track which workspace is currently active.
            </div>
          </div>
        </div>

        <div className="mt-6 flex flex-wrap gap-3 justify-end">
          {session.role === "developer" ? (
            <Button variant="ghost" onClick={() => nav("/admin")}>Go to Admin</Button>
          ) : null}
          <Button onClick={() => nav("/code")}>Go to Workspace</Button>
        </div>
      </Card>
    </div>
  );
}
