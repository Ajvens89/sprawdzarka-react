import { Link } from "react-router-dom";
import { ProductListPanel } from "./ProductListPanel";
import { PageHeader } from "../../components/ui/PageHeader";

export function ProductsPage(): JSX.Element {
  return (
    <div className="module-page">
      <PageHeader
        label="Sprzedaż"
        title="Lista produktów"
        description="Przeglądaj katalog gier, filtruj po stanie i wyszukuj po EAN."
      />
      <p className="module-page__hint">
        Aby szybko sprawdzić kod, przejdź do{" "}
        <Link to="/sprzedaz/skanuj">Skanuj grę</Link>.
      </p>
      <ProductListPanel />
    </div>
  );
}
