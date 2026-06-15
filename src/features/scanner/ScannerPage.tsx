import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { isCameraScannerSupported } from "../../components/scanner/EanCameraScanner";
import { useEanLookup } from "../../hooks/useEanLookup";
import { getResolvedStock } from "../../lib/scanner";
import { useAppStore } from "../../store/useAppStore";
import { PageHeader } from "../../components/ui/PageHeader";
import { ResultCard } from "./ResultCard";

export function ScannerPage(): JSX.Element {
  const stockOverrides = useAppStore((state) => state.stockOverrides);
  const stock = useMemo(() => getResolvedStock(stockOverrides), [stockOverrides]);
  const { result, recentScans, lookup } = useEanLookup({ emptyAsError: true, maxRecent: 5 });

  const [eanInput, setEanInput] = useState("");

  function checkEAN(value?: string): void {
    const lookupResult = lookup(value ?? eanInput);
    if (lookupResult.type === "not_found") {
      setEanInput("");
    }
    if (lookupResult.type === "found") {
      setEanInput("");
    }
  }

  return (
    <div className="module-page scanner-page">
      <PageHeader
        label="Sprzedaż"
        title="Skanuj grę"
        description="Zeskanuj lub wpisz EAN planszówki — zobaczysz cenę, stan i szybkie akcje."
      />

      {isCameraScannerSupported() ? (
        <div className="scanner-page__camera-cta">
          <Link className="btn-search" to="/sprzedaz/skanuj/aparat">
            Skaner aparatu (PWA)
          </Link>
          <p className="scanner-page__camera-hint">
            Zainstaluj na telefonie dla szybszego skanowania kodów EAN.
          </p>
        </div>
      ) : null}

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
              onChange={(event) => setEanInput(event.target.value.replace(/\D/g, "").slice(0, 13))}
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
            {isCameraScannerSupported() ? (
              <Link className="btn-ghost" to="/sprzedaz/skanuj/aparat">
                Skaner aparatu
              </Link>
            ) : null}
          </section>
        </aside>
      </div>
    </div>
  );
}
