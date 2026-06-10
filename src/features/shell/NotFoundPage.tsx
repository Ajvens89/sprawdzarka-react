import { Link } from "react-router-dom";
import { PageHeader } from "../../components/ui/PageHeader";

export function NotFoundPage(): JSX.Element {
  return (
    <div className="module-page not-found-page">
      <PageHeader
        label="Błąd"
        title="Nie znaleziono strony"
        description="Sprawdź adres URL lub wróć do głównego ekranu sprzedaży."
      />
      <div className="settings-actions">
        <Link className="btn-search" to="/sprzedaz/skanuj">
          Skanuj grę
        </Link>
        <Link className="btn-ghost" to="/raporty">
          Raporty
        </Link>
      </div>
    </div>
  );
}
