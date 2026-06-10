import { Link } from "react-router-dom";
import { BistroDetail } from "./BistroDetail";
import { BistroSidebar } from "./BistroSidebar";
import { BistroSummary } from "./BistroSummary";
import { PageHeader } from "../../components/ui/PageHeader";

export function BistroPage(): JSX.Element {
  return (
    <div className="module-page">
      <PageHeader
        label="Sprzedaż"
        title="Bistro"
        description="Sprzedaż jedzenia i napojów — porcje, zakupy i zysk."
      />

      <BistroSummary />

      <div className="workspace workspace-bistro">
        <BistroSidebar />
        <BistroDetail />
      </div>

      <p className="module-page__hint">
        Kasa na event: <Link to="/sprzedaz/kasa">Sprzedaż → Kasa</Link>
      </p>
    </div>
  );
}
