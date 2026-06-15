import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { EanCameraScanner, isCameraScannerSupported } from "../../components/scanner/EanCameraScanner";
import { useEanLookup } from "../../hooks/useEanLookup";
import { usePwaInstall } from "../../hooks/usePwaInstall";
import { getResolvedStock } from "../../lib/scanner";
import { useAppStore } from "../../store/useAppStore";
import { ResultCard } from "./ResultCard";

export function MobileScannerPage(): JSX.Element {
  const stockOverrides = useAppStore((state) => state.stockOverrides);
  const stock = useMemo(() => getResolvedStock(stockOverrides), [stockOverrides]);
  const { result, clearResult, recentScans, lookup } = useEanLookup({ maxRecent: 6 });

  const [manualInput, setManualInput] = useState("");
  const [cameraPaused, setCameraPaused] = useState(false);
  const { canInstall, install, isStandalone } = usePwaInstall();

  function handleLookup(raw: string): void {
    const lookupResult = lookup(raw);
    if (lookupResult.type === "found") {
      setManualInput("");
    }
  }

  return (
    <div className="mobile-scanner-page">
      <header className="mobile-scanner-page__header">
        <div>
          <span className="panel-label">Skaner mobilny</span>
          <h1 className="mobile-scanner-page__title">Skanuj aparatem</h1>
        </div>
        <Link className="btn-ghost mobile-scanner-page__back" to="/sprzedaz/skanuj">
          Pełny widok
        </Link>
      </header>

      {isCameraScannerSupported() ? (
        <EanCameraScanner onScan={handleLookup} paused={cameraPaused} />
      ) : (
        <div className="banner banner-warning mobile-scanner-page__unsupported">
          Aparat niedostępny w tej przeglądarce. Wpisz kod ręcznie poniżej lub użyj Chrome / Safari na telefonie.
        </div>
      )}

      <section className="panel panel-scan mobile-scanner-page__result">
        <ResultCard result={result} stock={stock} />
        {result.type === "found" ? (
          <button className="btn-search mobile-scanner-page__next" type="button" onClick={clearResult}>
            Skanuj kolejny produkt
          </button>
        ) : null}
      </section>

      <details className="panel mobile-scanner-page__manual">
        <summary>Wpisz kod ręcznie</summary>
        <div className="input-row" style={{ marginTop: "0.75rem" }}>
          <input
            type="text"
            inputMode="numeric"
            enterKeyHint="search"
            placeholder="np. 5902983494492"
            maxLength={13}
            autoComplete="off"
            value={manualInput}
            onChange={(event) => setManualInput(event.target.value.replace(/\D/g, "").slice(0, 13))}
            onKeyDown={(event) => {
              if (event.key === "Enter") handleLookup(manualInput);
            }}
          />
          <button className="btn-search" type="button" onClick={() => handleLookup(manualInput)}>
            Sprawdź
          </button>
        </div>
      </details>

      {recentScans.length > 0 ? (
        <section className="panel mobile-scanner-page__recent">
          <span className="panel-label">Ostatnie</span>
          <ul className="recent-scan-list">
            {recentScans.map((item) => (
              <li key={item.ean}>
                <button type="button" className="recent-scan-list__btn" onClick={() => handleLookup(item.ean)}>
                  <span>{item.title}</span>
                  <span className="mono">{item.ean}</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <div className="mobile-scanner-page__install">
        {isStandalone ? (
          <p className="mobile-scanner-page__install-hint mobile-scanner-page__install-hint--success">
            Aplikacja zainstalowana — otwierasz ją z ekranu początkowego.
          </p>
        ) : canInstall ? (
          <button className="btn-search mobile-scanner-page__install-btn" type="button" onClick={() => void install()}>
            Zainstaluj na telefonie
          </button>
        ) : (
          <p className="mobile-scanner-page__install-hint">
            Z menu przeglądarki wybierz „Dodaj do ekranu początkowego”, aby otwierać skaner jak natywną apkę.
          </p>
        )}
      </div>

      <button
        className="btn-ghost mobile-scanner-page__pause"
        type="button"
        onClick={() => setCameraPaused((value) => !value)}
      >
        {cameraPaused ? "Wznów aparat" : "Wstrzymaj aparat"}
      </button>
    </div>
  );
}
