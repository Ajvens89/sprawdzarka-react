import { useMemo, useState } from "react";
import { xlsxDownload } from "../../lib/export";
import {
  formatInventoryDifference,
  getInventoryEntries,
  getResolvedProducts,
  getResolvedStock
} from "../../lib/scanner";
import { normalizeEAN } from "../../lib/utils";
import { useAppStore } from "../../store/useAppStore";

export function InventoryPanel({ standalone = false }: { standalone?: boolean }): JSX.Element {
  const [scanInput, setScanInput] = useState("");
  const [status, setStatus] = useState<{ type: "info" | "success" | "error"; message: string } | null>(null);
  const [isReportOpen, setIsReportOpen] = useState(false);

  const stockOverrides = useAppStore((state) => state.stockOverrides);
  const priceOverrides = useAppStore((state) => state.priceOverrides);
  const inventoryCounts = useAppStore((state) => state.inventoryCounts);
  const inventoryVerified = useAppStore((state) => state.inventoryVerified);
  const inventoryOnlyDifferences = useAppStore((state) => state.inventoryOnlyDifferences);
  const registerInventoryScan = useAppStore((state) => state.registerInventoryScan);
  const updateInventoryCount = useAppStore((state) => state.updateInventoryCount);
  const verifyInventoryZero = useAppStore((state) => state.verifyInventoryZero);
  const clearInventoryVerification = useAppStore((state) => state.clearInventoryVerification);
  const toggleInventoryOnlyDifferences = useAppStore((state) => state.toggleInventoryOnlyDifferences);
  const resetInventory = useAppStore((state) => state.resetInventory);

  const stock = getResolvedStock(stockOverrides);
  const products = useMemo(() => getResolvedProducts(priceOverrides), [priceOverrides]);
  const entries = useMemo(
    () => getInventoryEntries(products, stock, inventoryCounts, inventoryVerified, inventoryOnlyDifferences),
    [inventoryCounts, inventoryOnlyDifferences, inventoryVerified, products, stock]
  );

  function handleScan(): void {
    const ean = normalizeEAN(scanInput);
    if (!/^\d{13}$/.test(ean)) {
      setStatus({ type: "error", message: "Kod do liczenia stanów musi mieć dokładnie 13 cyfr." });
      return;
    }

    const product = products.find((item) => item.ean === ean);
    if (!product) {
      setStatus({ type: "error", message: `Kod ${ean} nie istnieje w bazie produktów.` });
      setScanInput("");
      return;
    }

    registerInventoryScan(ean);
    const scanned = (inventoryCounts[ean] ?? 0) + 1;
    const baseline = stock[ean];
    setStatus({
      type: "success",
      message: `Dodano ${product.tytuł}. Zeskanowano po wydarzeniu: ${scanned} szt. · stan bazowy: ${baseline ?? "brak danych"}`
    });
    setScanInput("");
  }

  function handleVerifyZero(): void {
    const ean = normalizeEAN(scanInput);
    if (!/^\d{13}$/.test(ean)) {
      setStatus({ type: "error", message: "Wpisz poprawny 13-cyfrowy kod EAN, aby oznaczyć 0 szt." });
      return;
    }

    const product = products.find((item) => item.ean === ean);
    if (!product) {
      setStatus({ type: "error", message: `Kod ${ean} nie istnieje w bazie produktów.` });
      return;
    }

    verifyInventoryZero(ean);
    setStatus({
      type: "info",
      message: `Oznaczono ${product.tytuł} jako sprawdzone: 0 szt.`
    });
    setScanInput("");
  }

  function handleExport(): void {
    const rows: Array<Array<string | number>> = [
      ["EAN", "Tytuł", "Cena (zł)", "Zweryfikowano", "Zeskanowano", "Stan bazowy", "Różnica"]
    ];

    entries.forEach((entry) => {
      rows.push([
        entry.ean,
        entry.product.tytuł,
        entry.product.cena,
        entry.verified ? "TAK" : "NIE",
        entry.verified ? entry.qty : "",
        entry.baseline ?? "",
        entry.difference ?? ""
      ]);
    });

    xlsxDownload(rows, "stany_po_wydarzeniu.xlsx", "Stany");
    setStatus({ type: "success", message: "Wyeksportowano plik Excel ze stanami." });
  }

  function handleResetInventory(): void {
    if (
      !window.confirm(
        "Reset wyczyści wszystkie zeskanowane stany inwentaryzacji. Tej operacji nie można cofnąć. Kontynuować?"
      )
    ) {
      return;
    }

    resetInventory();
    setStatus({ type: "info", message: "Wyczyszczono dane inwentaryzacji." });
  }

  return (
    <section className={`panel panel-inventory${standalone ? " panel-inventory--standalone" : ""}`}>
      <span className="panel-label">Weryfikacja stanów</span>

      <div className="input-row" style={{ marginBottom: ".6rem" }}>
        <input
          type="text"
          value={scanInput}
          onChange={(event) => setScanInput(normalizeEAN(event.target.value))}
          onKeyDown={(event) => {
            if (event.key === "Enter") handleScan();
            if (event.key === "Escape") setScanInput("");
          }}
          placeholder="Skanuj EAN do liczenia"
          inputMode="numeric"
          maxLength={13}
        />
      </div>

      <div className="inventory-toolbar">
        <button className="btn-search" type="button" onClick={handleScan}>Dodaj sztukę</button>
        <button className="btn-ghost" type="button" onClick={() => setScanInput("")}>Wyczyść</button>
        <button className="btn-ghost" type="button" onClick={handleVerifyZero}>0 ✓</button>
      </div>

      <div className="inventory-toolbar">
        <button
          className={`btn-toggle${inventoryOnlyDifferences ? " active" : ""}`}
          type="button"
          onClick={toggleInventoryOnlyDifferences}
        >
          Tylko różnice
        </button>
        <button className="btn-ghost" type="button" onClick={() => setIsReportOpen(true)}>Raport</button>
        <button className="btn-ghost" type="button" onClick={handleExport}>Eksport XLSX</button>
        {!standalone ? (
          <button className="btn-ghost btn-ghost--danger" type="button" onClick={handleResetInventory}>
            Reset
          </button>
        ) : null}
      </div>

      <div
        className={`inventory-status ${status?.type ?? ""}`}
        style={{ display: status ? "block" : "none" }}
        aria-live="polite"
      >
        {status?.message}
      </div>

      <div className="inventory-list">
        {entries.length === 0 ? (
          <div className="empty-state">Brak pozycji do pokazania dla aktualnego filtra.</div>
        ) : (
          entries.map((entry) => {
            const difference = formatInventoryDifference(entry.difference, entry.verified);
            const baselineLabel = entry.baseline === null ? "stan w pliku: —" : `stan w pliku: ${entry.baseline}`;

            return (
              <div
                key={entry.ean}
                className={`inventory-item ${entry.verified ? "verified" : "pending"}${entry.hasDifference ? " has-difference" : ""}`}
              >
                <div className="inventory-item-main">
                  <div className="inventory-item-title">{entry.product.tytuł}</div>
                  <div className="inventory-item-meta">
                    <span className="inventory-pill">EAN: {entry.ean}</span>
                    <span className={`inventory-pill ${difference.className}`}>{difference.label}</span>
                    <span className="inventory-pill">{entry.verified ? `stan końcowy: ${entry.qty}` : "stan końcowy: —"}</span>
                    <span className="inventory-pill">{baselineLabel}</span>
                  </div>
                </div>

                <div className="inventory-item-actions">
                  <button
                    type="button"
                    className="btn-mini"
                    onClick={() => updateInventoryCount(entry.ean, -1)}
                    disabled={entry.qty <= 0}
                    aria-label={`Odejmij jedną sztukę dla ${entry.product.tytuł}`}
                  >
                    −
                  </button>

                  <div className="inventory-qty">{entry.verified ? `${entry.qty} szt.` : "—"}</div>

                  <button
                    type="button"
                    className="btn-mini"
                    onClick={() => updateInventoryCount(entry.ean, 1)}
                    aria-label={`Dodaj jedną sztukę dla ${entry.product.tytuł}`}
                  >
                    +
                  </button>

                  <button
                    type="button"
                    className="btn-mini btn-wide"
                    onClick={() => verifyInventoryZero(entry.ean)}
                    aria-label={`Oznacz ${entry.product.tytuł} jako sprawdzone i policzone na zero`}
                  >
                    0✓
                  </button>

                  <button
                    type="button"
                    className="btn-mini"
                    onClick={() => clearInventoryVerification(entry.ean)}
                    aria-label={`Cofnij weryfikację produktu ${entry.product.tytuł}`}
                  >
                    ↺
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {isReportOpen ? (
        <div className="report-modal" onClick={() => setIsReportOpen(false)}>
          <div className="report-modal-box" onClick={(event) => event.stopPropagation()}>
            <div className="report-modal-header">
              <div className="report-modal-title">Raport stanów po wydarzeniu</div>
              <button className="report-close" onClick={() => setIsReportOpen(false)}>✕</button>
            </div>

            <div className="report-kpi-row">
              <div className="report-kpi">
                <div className="report-kpi-label">Pozycji</div>
                <div className="report-kpi-value">{entries.length}</div>
              </div>
              <div className="report-kpi">
                <div className="report-kpi-label">Zweryfikowane</div>
                <div className="report-kpi-value ok">{entries.filter((entry) => entry.verified).length}</div>
              </div>
              <div className="report-kpi">
                <div className="report-kpi-label">Różnice</div>
                <div className="report-kpi-value diff">{entries.filter((entry) => entry.hasDifference).length}</div>
              </div>
              <div className="report-kpi">
                <div className="report-kpi-label">Suma sztuk</div>
                <div className="report-kpi-value sold">
                  {entries.reduce((sum, entry) => sum + (entry.verified ? entry.qty : 0), 0)}
                </div>
              </div>
            </div>

            <div className="report-table-wrap">
              <table className="report-table">
                <thead>
                  <tr>
                    <th>Produkt</th>
                    <th>EAN</th>
                    <th className="num">Stan końcowy</th>
                    <th className="num">Stan bazowy</th>
                    <th className="num">Różnica</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {entries.map((entry) => (
                    <tr key={`report-${entry.ean}`}>
                      <td>{entry.product.tytuł}</td>
                      <td>{entry.ean}</td>
                      <td className="num">{entry.verified ? entry.qty : "—"}</td>
                      <td className="num">{entry.baseline ?? "—"}</td>
                      <td className="num">{entry.difference ?? "—"}</td>
                      <td>
                        <span className={entry.hasDifference ? "report-status-diff" : entry.verified ? "report-status-ok" : "report-status-unk"}>
                          {entry.hasDifference ? "różnica" : entry.verified ? "zgodne" : "nie sprawdzono"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="report-footer">
              <button className="btn-search" type="button" onClick={handleExport}>Eksport XLSX</button>
              <button className="btn-ghost" type="button" onClick={() => setIsReportOpen(false)}>Zamknij</button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
