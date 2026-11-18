export default function Select({ label, children, className = "", ...rest }) {
  return (
    <label className="block space-y-2">
      {label && <div className="iv-label">{label}</div>}
      <select className={`iv-field ${className}`} {...rest}>
        {children}
      </select>
    </label>
  );
}
