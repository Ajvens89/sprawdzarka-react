import { PageHeader } from "../../components/ui/PageHeader";
import { AdminPage } from "../admin/AdminPage";

export function CostsMarginPage(): JSX.Element {
  return (
    <div className="module-page">
      <PageHeader
        label="Ceny i marże"
        title="Koszty i marże"
        description="Tabela kosztów zakupu, marży i cen sprzedaży. Porównanie cen ze stanem magazynowym."
      />
      <AdminPage view="costs" />
    </div>
  );
}
