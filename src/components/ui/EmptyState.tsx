export function EmptyState({
  title,
  description
}: {
  title: string;
  description?: string;
}): JSX.Element {
  return (
    <div className="empty-state ui-empty-state">
      <strong>{title}</strong>
      {description ? <p>{description}</p> : null}
    </div>
  );
}
