export function StatusPill({
  variant,
  children,
  hint
}: {
  variant: "ok" | "warning" | "error" | "muted";
  children: React.ReactNode;
  hint?: string;
}): JSX.Element {
  return (
    <span className={`status-pill status-pill--${variant}${hint ? " status-pill--hint" : ""}`} title={hint}>
      {children}
      {hint ? (
        <span className="status-pill__info" aria-label={hint}>
          ⓘ
        </span>
      ) : null}
    </span>
  );
}
