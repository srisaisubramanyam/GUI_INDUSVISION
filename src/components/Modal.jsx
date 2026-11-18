export default function Modal({ open, title, children, onClose }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-[rgba(29,24,20,0.42)] backdrop-blur-sm" onClick={onClose} />
      <div className="relative flex max-h-[calc(100vh-2rem)] w-full max-w-xl flex-col overflow-hidden iv-card shadow-[var(--shadow-lg)]">
        <div className="iv-card-header shrink-0">
          <div className="text-lg font-semibold">{title}</div>
          <button
            onClick={onClose}
            title="Close"
            aria-label="Close"
            className="iv-btn iv-btn--ghost !h-10 !w-10 !rounded-full !px-0 !py-0 !text-[color:var(--muted)] hover:!text-[color:var(--text)]"
          >
            &times;
          </button>
        </div>
        <div className="iv-card-body overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}
