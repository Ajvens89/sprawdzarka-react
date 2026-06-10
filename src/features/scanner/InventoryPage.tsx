import { InventoryPanel } from "../scanner/InventoryPanel";
import { PageHeader } from "../../components/ui/PageHeader";

export function InventoryPage(): JSX.Element {
  return (
    <div className="module-page">
      <PageHeader
        label="Sprzedaż"
        title="Inwentaryzacja"
        description="Liczenie stanów po evencie — skanuj EAN-y i porównuj z bazą."
      />
      <InventoryPanel standalone />
    </div>
  );
}
