import { Link } from "react-router-dom";
import { PageHeader } from "../../components/ui/PageHeader";

export function ReportsHubPage(): JSX.Element {
  return (
    <div className="module-page">
      <PageHeader
        label="Raporty"
        title="Eksporty i zestawienia"
        description="Przygotuj pliki dla klienta, inwentaryzacji i kosztów."
      />

      <div className="report-hub-grid">
        <Link className="report-hub-card" to="/raporty/klient">
          <span className="report-hub-card__title">Raport dla klienta</span>
          <span className="report-hub-card__desc">Excel ze stanami gier: do skasowania, zostało, podsumowanie.</span>
        </Link>

        <Link className="report-hub-card" to="/raporty/inwentaryzacja">
          <span className="report-hub-card__title">Eksport inwentaryzacji</span>
          <span className="report-hub-card__desc">Excel ze zliczonymi stanami po evencie.</span>
        </Link>

        <Link className="report-hub-card" to="/ceny/koszty">
          <span className="report-hub-card__title">Eksport kosztów i marży</span>
          <span className="report-hub-card__desc">Pobierz tabelę kosztów zakupu i marży do Excela.</span>
        </Link>

        <Link className="report-hub-card" to="/sprzedaz/inwentaryzacja">
          <span className="report-hub-card__title">Inwentaryzacja na żywo</span>
          <span className="report-hub-card__desc">Skanuj EAN-y i licz stany po wydarzeniu.</span>
        </Link>
      </div>
    </div>
  );
}
