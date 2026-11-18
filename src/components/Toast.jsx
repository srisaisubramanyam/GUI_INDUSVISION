import { useToast } from "./useToast.jsx";

export default function ToastHost() {
  const t = useToast();
  if (!t) return null;

  return (
    <div className="fixed bottom-5 right-5 z-[60] space-y-3">
      {t.items.map(x => (
        <div
          key={x.id}
          className={`rounded-[20px] border px-4 py-3 backdrop-blur shadow-[0_16px_34px_rgba(66,49,33,0.16)]
            ${x.type === "running"
              ? "bg-emerald-100/90 border-emerald-300 text-emerald-950"
              : x.type === "success"
              ? "bg-emerald-50/95 border-emerald-200 text-emerald-900"
              : x.type === "stopped"
              ? "bg-rose-100/95 border-rose-300 text-rose-950"
              : x.type === "error"
              ? "bg-rose-50/95 border-rose-200 text-rose-900"
              : "bg-[rgba(248,241,230,0.96)] border-[color:var(--border)] text-[color:var(--text)]"
            }`}
        >
          <div className="text-sm">{x.message}</div>
        </div>
      ))}
    </div>
  );
}
