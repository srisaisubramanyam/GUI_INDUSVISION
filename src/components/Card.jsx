export default function Card({ title, right, children, className = "" }) {
  return (
    <div className={`iv-card ${className}`}>
      {(title || right) && (
        <div className="iv-card-header">
          <div className="font-semibold">{title}</div>
          <div>{right}</div>
        </div>
      )}
      <div className="iv-card-body">{children}</div>
    </div>
  );
}
