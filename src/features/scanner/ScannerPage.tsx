import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { LEGACY_PRODUCTS, getResolvedProducts, getResolvedStock } from "../../lib/scanner";
import { normalizeEAN } from "../../lib/utils";
import { useAppStore } from "../../store/useAppStore";
import { PageHeader } from "../../components/ui/PageHeader";
import { ResultCard } from "./ResultCard";

type ResultState =
  | { type: "idle" }
  | { type: "found"; product: (typeof LEGACY_PRODUCTS)[number] }
  | { type: "error"; title: string; message: string };

type RecentScan = {
  ean: string;
  title: string;
  at: number;
};

const MAX_RECENT = 5;

function productTitle(product: (typeof LEGACY_PRODUCTS)[number]): string {
  return product.tytuł;
}

export function ScannerPage(): JSX.Element {
  const stockOverrides = useAppStore((state) => state.stockOverrides);
  const priceOverrides = useAppStore((state) => state.priceOverrides);
  const stock = useMemo(() => getResolvedStock(stockOverrides), [stockOverrides]);
  const products = useMemo(() => getResolvedProducts(priceOverrides), [priceOverrides]);

  const [eanInput, setEanInput] = useState("");
  const [result, setResult] = useState<ResultState>({ type: "idle" });
  const [recentScans, setRecentScans] = useState<RecentScan[]>([]);

  useEffect(() => {
    if (result.type !== "found") return;

    const refreshedProduct = products.find((item) => item.ean === result.product.ean);
    if (refreshedProduct && refreshedProduct.cena !== result.product.cena) {
      setResult({ type: "found", product: refreshedProduct });
    }
  }, [products, result]);

  function checkEAN(value?: string): void {
    const query = normalizeEAN(value ?? eanInput);

    if (!query) {
      setResult({
        type: "error",
        title: "✗ Brak kodu",
        message: "Wpisz 13-cyfrowy kod EAN."
      });
      return;
    }

    if (!/^\d{13}$/.test(query)) {
      setResult({
        type: "error",
        title: "✗ Nieprawidłowy kod",
        message: "Wpisz poprawny 13-cyfrowy kod EAN."
      });
      return;
    }

    const product = products.find((item) => item.ean === query);

    if (!product) {
      setResult({
        type: "error",
        title: "✗ Nie znaleziono",
        message: `Kod EAN ${query} nie istnieje w bazie produktów z targów.`
      });
      setEanInput("");
      return;
    }

    setResult({ type: "found", product });
    setRecentScans((current) => {
      const next = [{ ean: product.ean, title: productTitle(product), at: Date.now() }, ...current.filter((item) => item.ean !== product.ean)];
      return next.slice(0, MAX_RECENT);
    });
    setEanInput("");
  }

  return (
    <div className="module-page scanner-page">
      <PageHeader
        label="Sprzedaż"
        title="Skanuj grę"
        description="Zeskanuj lub wpisz EAN planszówki — zobaczysz cenę, stan i szybkie akcje."
      />

      <div className="scanner-page__layout">
        <section className="panel panel-scan scanner-page__main">
          <div className="input-row" style={{ marginBottom: ".5rem" }}>
            <input
              type="text"
              id="eanInput"
              placeholder="np. 5902983494492"
              maxLength={13}
              autoComplete="off"
              inputMode="numeric"
              enterKeyHint="search"
              value={eanInput}
              onChange={(event) => setEanInput(normalizeEAN(event.target.value))}
              onKeyDown={(event) => {
                if (event.key === "Enter") checkEAN();
                if (event.key === "Escape") setEanInput("");
              }}
            />
            <button className="btn-ghost" type="button" onClick={() => setEanInput("")}>
              Wyczyść
            </button>
            <button className="btn-search" type="button" onClick={() => checkEAN()}>
              Sprawdź
            </button>
          </div>

          <ResultCard result={result} stock={stock} />
        </section>

        <aside className="scanner-page__aside">
          {recentScans.length > 0 ? (
            <section className="panel">
              <span className="panel-label">Ostatnie skany</span>
              <ul className="recent-scan-list">
                {recentScans.map((item) => (
                  <li key={item.ean}>
                    <button type="button" className="recent-scan-list__btn" onClick={() => checkEAN(item.ean)}>
                      <span>{item.title}</span>
                      <span className="mono">{item.ean}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          <section className="panel scanner-quick-links">
            <span className="panel-label">Więcej — gry</span>
            <Link className="btn-ghost" to="/sprzedaz/produkty">
              Lista produktów
            </Link>
            <Link className="btn-ghost" to="/sprzedaz/inwentaryzacja">
              Inwentaryzacja
            </Link>
          </section>
        </aside>
      </div>
    </div>
  );
}
