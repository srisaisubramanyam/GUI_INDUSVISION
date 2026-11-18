export default function Button({
  children,
  variant = "primary",
  disabled,
  className = "",
  ...props
}) {
  const variants = {
    primary: "iv-btn--primary",
    secondary: "iv-btn--secondary",
    ghost: "iv-btn--ghost",
    danger: "iv-btn--danger"
  };

  return (
    <button
      className={`iv-btn ${variants[variant] || variants.primary} ${className}`}
      disabled={disabled}
      {...props}
    >
      {children}
    </button>
  );
}
