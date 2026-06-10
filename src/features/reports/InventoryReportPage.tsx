import { Link } from "react-router-dom";
import { InventoryPanel } from "../scanner/InventoryPanel";
import { PageHeader } from "../../components/ui/PageHeader";

export function InventoryReportPage(): JSX.Element {
  return (
    <div className="module-page">
      <PageHeader
        label="Raporty"
        title="Eksport inwentaryzacji"
        description="Pobierz Excel ze zliczonymi stanami. Najpierw zlicz produkty w inwentaryzacji."
      />
      <p className="module-page__hint">
        Pełne liczenie stanów:{" "}
        <Link to="/sprzedaz/inwentaryzacja">Sprzedaż → Inwentaryzacja</Link>.
      </p>
      <InventoryPanel standalone />
    </div>
  );
}
