import { Link } from "react-router-dom";
import { PageHeader } from "../../components/ui/PageHeader";
import { PriceAdvisorPage } from "../prices/PriceAdvisorPage";

export function MarketPricesPage(): JSX.Element {
  return (
    <div className="module-page">
      <PageHeader
        label="Ceny i marże"
        title="Ceny rynkowe"
        description="Porównaj nasze ceny z internetem. Status OK / za drogo / brak danych."
      />
      <p className="module-page__hint">
        Koszty zakupu i marżę edytujesz w{" "}
        <Link to="/ceny/koszty">Koszty i marże</Link>.
      </p>
      <PriceAdvisorPage embedded />
    </div>
  );
}
