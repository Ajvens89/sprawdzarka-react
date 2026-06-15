import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { BASE_STOCK } from "../../data/stock";
import type { Product, StockMap } from "../../types/app";
import { fetchOnlinePrice, PriceCheckError } from "../../lib/priceCheck";
import { getStockState, renderFoundPrice } from "../../lib/scanner";
import { formatMoney } from "../../lib/utils";
import { useAppStore } from "../../store/useAppStore";

type ResultState =
  | { type: "idle" }
  | { type: "found"; product: Product }
  | { type: "error"; title: string; message: string };

function parseStockInput(value: string): number | null {
  const normalized = value.replace(",", ".").replace(/[^\d.]/g, "");
  if (!normalized) return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) && parsed >= 0 ? Math.round(parsed) : null;
}

export function ResultCard({
  result,
  stock
}: {
  result: ResultState;
  stock: StockMap;
}): JSX.Element | null {
  const setStockOverride = useAppStore((state) => state.setStockOverride);
  const replaceStockOverrides = useAppStore((state) => state.replaceStockOverrides);
  const setPriceEntry = useAppStore((state) => state.setPriceEntry);
  const [stockInput, setStockInput] = useState("");
  const [isCheckingPrice, setIsCheckingPrice] = useState(false);
  const [priceCheckMessage, setPriceCheckMessage] = useState<string | null>(null);
  const [marketPrice, setMarketPrice] = useState<number | null>(null);
  const [marketSource, setMarketSource] = useState("");
  const priceCheckGenerationRef = useRef(0);
  const foundEan = result.type === "found" ? result.product.ean : null;
  const hasOverride = useAppStore((state) =>
    foundEan ? Object.prototype.hasOwnProperty.call(state.stockOverrides, foundEan) : false
  );

  useEffect(() => {
    priceCheckGenerationRef.current += 1;
    setMarketPrice(null);
    setMarketSource("");
    setPriceCheckMessage(null);
    setIsCheckingPrice(false);
  }, [foundEan]);

  if (result.type === "idle") return null;

  if (result.type === "error") {
    return (
      <div className="result-card not-found" style={{ display: "block" }}>
        <div className="result-label">{result.title}</div>
        <div className="not-found-msg">{result.message}</div>
      </div>
    );
  }

  const [whole, decimal] = renderFoundPrice(result.product.cena);
  const stockState = getStockState(result.product.ean, stock);
  const product = result.product;
  const baseline = BASE_STOCK[product.ean];
  const resolvedQty = stock[product.ean];

  function handleApplyStock(): void {
    const parsed = parseStockInput(stockInput);
    if (parsed === null) return;
    setStockOverride(product.ean, parsed);
    setStockInput("");
  }

  function handleClearOverride(): void {
    if (!hasOverride) return;
    const stockOverrides = useAppStore.getState().stockOverrides;
    const next = { ...stockOverrides };
    delete next[product.ean];
    replaceStockOverrides(next);
    setStockInput("");
  }

  async function handleCheckOnlinePrice(): Promise<void> {
    const generation = ++priceCheckGenerationRef.current;
    const { ean, tytuł, cena } = product;

    setIsCheckingPrice(true);
    setPriceCheckMessage(null);

    try {
      const priceResult = await fetchOnlinePrice({
        ean,
        title: tytuł,
        currentPrice: cena,
        force: true
      });

      if (generation !== priceCheckGenerationRef.current) return;

      setMarketPrice(priceResult.price);
      setMarketSource(priceResult.source);
      setPriceCheckMessage(priceResult.message);

      setPriceEntry(ean, {
        marketPrice: priceResult.price ? priceResult.price.toFixed(2).replace(".", ",") : "",
        source: priceResult.source,
        checkedAt: new Date().toLocaleString("pl-PL"),
        status: priceResult.message
      });
    } catch (error) {
      if (generation !== priceCheckGenerationRef.current) return;
      if (error instanceof PriceCheckError) {
        setPriceCheckMessage(error.payload.message);
        return;
      }
      setPriceCheckMessage("Błąd połączenia ze sprawdzaniem cen online.");
    } finally {
      if (generation === priceCheckGenerationRef.current) {
        setIsCheckingPrice(false);
      }
    }
  }

  const priceDifference =
    marketPrice !== null ? Math.round((product.cena - marketPrice) * 100) / 100 : null;

  return (
    <div className="result-card found" style={{ display: "block" }}>
      <div className="result-label">✓ Produkt znaleziony</div>
      <div className="result-title">{product.tytuł}</div>

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

      <div className="result-price-check">
        <button
          className="btn-search"
          type="button"
          disabled={isCheckingPrice}
          onClick={() => void handleCheckOnlinePrice()}
        >
          {isCheckingPrice ? "Sprawdzam cenę…" : "Sprawdź cenę online"}
        </button>

        {marketPrice !== null ? (
          <div className="result-price-check-summary">
            <span>
              W internecie: <strong>{formatMoney(marketPrice)}</strong>
              {marketSource ? ` · ${marketSource}` : ""}
            </span>
            {priceDifference !== null ? (
              <span className={priceDifference > 0 ? "price-status danger" : "price-status success"}>
                {priceDifference > 0
                  ? `Nasza cena wyższa o ${formatMoney(priceDifference)}`
                  : priceDifference < 0
                    ? `Nasza cena niższa o ${formatMoney(Math.abs(priceDifference))}`
                    : "Cena jak w internecie"}
              </span>
            ) : null}
          </div>
        ) : null}

        {priceCheckMessage ? <span className="price-check-note">{priceCheckMessage}</span> : null}

        <Link className="btn-ghost result-price-check-link" to="/ceny/rynek">
          Ceny rynkowe →
        </Link>
        <Link className="btn-ghost result-price-check-link" to="/ceny/koszty">
          Koszty i marże →
        </Link>
      </div>

      <div className="stock-override-editor">
        <div className="stock-override-head">
          <span className="stock-override-label">Stan magazynowy</span>
          {hasOverride ? <span className="stock-override-badge">korekta</span> : null}
        </div>
        <div className="stock-override-meta">
          <span>Aktualnie: {resolvedQty ?? "—"} szt.</span>
          <span>Plik bazowy: {baseline ?? "brak"}</span>
        </div>
        <div className="stock-override-row">
          <input
            className="admin-cost-input stock-override-input"
            inputMode="numeric"
            placeholder={resolvedQty !== undefined ? String(resolvedQty) : "0"}
            value={stockInput}
            onChange={(event) => setStockInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") handleApplyStock();
            }}
            aria-label={`Nowy stan magazynowy dla ${product.tytuł}`}
          />
          <button className="btn-mini" type="button" onClick={handleApplyStock}>
            Zapisz
          </button>
          {hasOverride ? (
            <button className="btn-mini btn-mini--ghost" type="button" onClick={handleClearOverride}>
              Przywróć bazowy
            </button>
          ) : null}
        </div>
      </div>

      <div className="ean-display">EAN: {product.ean}</div>
    </div>
  );
}
