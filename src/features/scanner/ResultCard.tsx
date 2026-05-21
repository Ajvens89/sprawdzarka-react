import type { Product, StockMap } from "../../types/app";
import { getStockState, renderFoundPrice } from "../../lib/scanner";

type ResultState =
  | { type: "idle" }
  | { type: "found"; product: Product }
  | { type: "error"; title: string; message: string };

export function ResultCard({
  result,
  stock
}: {
  result: ResultState;
  stock: StockMap;
}): JSX.Element | null {
  if (result.type === "idle") return null;

  if (result.type === "error") {
    return (
      <div className="result-card not-found" style={{ display: "block" }}>
        <div className="result-label">{result.title}</div>
        <div className="not-found-msg" dangerouslySetInnerHTML={{ __html: result.message }} />
      </div>
    );
  }

  const [whole, decimal] = renderFoundPrice(result.product.cena);
  const stockState = getStockState(result.product.ean, stock);

  return (
    <div className="result-card found" style={{ display: "block" }}>
      <div className="result-label">✓ Produkt znaleziony</div>
      <div className="result-title">{result.product.tytuł}</div>

      <div className="result-price-block">
        <div>
          <div className="price-line">
            <span className="price-tag">
              {whole}
              <span className="price-tag-decimal">,{decimal}</span>
            </span>
            <span className="price-currency">zł</span>
          </div>
          <div className="price-desc">sugerowana cena detaliczna (brutto)</div>
        </div>
      </div>

      <div className={`stock-badge ${stockState.className}`}>
        <span className="stock-badge-label">{stockState.label}</span>
      </div>

      <div className="ean-display">EAN: {result.product.ean}</div>
    </div>
  );
}
