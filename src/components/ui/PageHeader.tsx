export function PageHeader({
  label,
  title,
  description
}: {
  label?: string;
  title: string;
  description?: string;
}): JSX.Element {
  return (
    <header className="page-header">
      {label ? <span className="page-header__label">{label}</span> : null}
      <h1 className="page-header__title">{title}</h1>
      {description ? <p className="page-header__desc">{description}</p> : null}
    </header>
  );
}
