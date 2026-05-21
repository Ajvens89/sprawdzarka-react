import { useEffect, useMemo, useState } from "react";
import { LEGACY_PRODUCTS, getResolvedProducts, getResolvedStock } from "../../lib/scanner";
import { normalizeEAN } from "../../lib/utils";
import { useAppStore } from "../../store/useAppStore";
import { InventoryPanel } from "./InventoryPanel";
import { ProductListPanel } from "./ProductListPanel";
import { ResultCard } from "./ResultCard";

type ResultState =
  | { type: "idle" }
  | { type: "found"; product: (typeof LEGACY_PRODUCTS)[number] }
  | { type: "error"; title: string; message: string };

export function ScannerPage(): JSX.Element {
  const stockOverrides = useAppStore((state) => state.stockOverrides);
  const priceOverrides = useAppStore((state) => state.priceOverrides);
  const stock = useMemo(() => getResolvedStock(stockOverrides), [stockOverrides]);
  const products = useMemo(() => getResolvedProducts(priceOverrides), [priceOverrides]);

  const [eanInput, setEanInput] = useState("");
  const [result, setResult] = useState<ResultState>({ type: "idle" });

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
        message: `Kod EAN <strong>${query}</strong> nie istnieje w bazie produktów z targów.`
      });
      setEanInput("");
      return;
    }

    setResult({ type: "found", product });
    setEanInput("");
  }

  return (
    <div className="workspace workspace-main">
      <aside className="panel panel-scan">
        <span className="panel-label">Skanowanie EAN</span>

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
          <button className="btn-ghost" type="button" onClick={() => setEanInput("")}>Wyczyść</button>
          <button className="btn-search" type="button" onClick={() => checkEAN()}>Sprawdź</button>
        </div>

        <p className="hint">Zeskanuj lub wpisz 13-cyfrowy kod EAN — wynik pojawi się od razu po sprawdzeniu.</p>
        <ResultCard result={result} stock={stock} />
      </aside>

      <ProductListPanel
        onSelectProduct={(ean) => {
          setEanInput(ean);
          checkEAN(ean);
          window.scrollTo({ top: 0, behavior: "smooth" });
        }}
      />

      <InventoryPanel />
    </div>
  );
}
