export default function Input({ label, ...props }) {
  return (
    <label className="block space-y-2">
      {label && <div className="iv-label">{label}</div>}
      <input
        {...props}
        className="iv-field"
      />
    </label>
  );
}
