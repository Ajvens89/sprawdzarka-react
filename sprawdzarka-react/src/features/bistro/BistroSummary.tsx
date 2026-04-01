import { bistroSummaryCalc } from "../../lib/bistro";
import { formatMoney } from "../../lib/utils";
import { useAppStore } from "../../store/useAppStore";

export function BistroSummary(): JSX.Element {
  const products = useAppStore((state) => state.bistroProducts);
  const summary = bistroSummaryCalc(products);

  return (
    <div className="bistro-summary">
      <div className="bistro-kpi revenue">
        <div className="bistro-kpi-label">Przychód</div>
        <div className="bistro-kpi-value">{formatMoney(summary.totalRevenue)}</div>
      </div>

      <div className="bistro-kpi cost">
        <div className="bistro-kpi-label">Koszt sprzedanych porcji</div>
        <div className="bistro-kpi-value">{formatMoney(summary.totalCost)}</div>
      </div>

      <div className="bistro-kpi profit">
        <div className="bistro-kpi-label">Zysk</div>
        <div className="bistro-kpi-value">{formatMoney(summary.totalProfit)}</div>
      </div>

      <div className="bistro-kpi margin">
        <div className="bistro-kpi-label">Marża</div>
        <div className="bistro-kpi-value">{summary.margin === null ? "—" : `${summary.margin.toFixed(1).replace(".", ",")} %`}</div>
      </div>
    </div>
  );
}
