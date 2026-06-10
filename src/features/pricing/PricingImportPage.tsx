import { Link } from "react-router-dom";
import { PageHeader } from "../../components/ui/PageHeader";
import { AdminPage } from "../admin/AdminPage";

export function PricingImportPage(): JSX.Element {
  return (
    <div className="module-page">
      <PageHeader
        label="Ceny i marże"
        title="Import kosztów"
        description="Wgraj koszty z Excela lub inFakt/KSeF, potem porównaj ceny w tabeli marży."
      />
      <p className="module-page__hint">
        Po imporcie przejdź do{" "}
        <Link to="/ceny/koszty">Koszty i marże</Link>, aby zobaczyć marże i uruchomić porównanie cen online.
      </p>
      <AdminPage view="import" />
    </div>
  );
}
