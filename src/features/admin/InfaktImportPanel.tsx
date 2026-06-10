import { useMemo, useState } from "react";
import { EVENT_DATE } from "../../data/meta";
import { LEGACY_PRODUCTS, getResolvedStock } from "../../lib/scanner";
import { normalizeText } from "../../lib/utils";
import {
  getInfaktCostDetail,
  getInfaktKsefCostLines,
  listInfaktCosts,
  listInfaktKsefCosts,
  type InfaktCostSummary,
  type InfaktImportLine,
  type InfaktKsefSummary
} from "../../lib/infaktApi";
import { useAppStore } from "../../store/useAppStore";

const EAN_MAP_KEY = "sprawdzarka-infakt-ean-map";

type SourceMode = "infakt" | "ksef";

type DraftRow = InfaktImportLine & {
  invoiceLabel: string;
  selected: boolean;
  ean: string;
};

function monthToDateDefault(): { from: string; to: string } {
  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth(), 1);
  const fmt = (date: Date) =>
    `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  return { from: fmt(from), to: fmt(now) };
}

function eventDateRange(): { from: string; to: string } {
  const match = EVENT_DATE.match(/(\d{2})\.(\d{2})\.(\d{4})/);
  if (!match) {
    return { from: "2026-03-01", to: "2026-03-31" };
  }

  const [, day, month, year] = match;
  const event = new Date(Number(year), Number(month) - 1, Number(day));
  const from = new Date(event);
  from.setDate(from.getDate() - 14);
  const to = new Date(event);
  to.setDate(to.getDate() + 7);

  const fmt = (date: Date) =>
    `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

  return { from: fmt(from), to: fmt(to) };
}

function loadEanMap(): Record<string, string> {
  try {
    const raw = window.localStorage.getItem(EAN_MAP_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, string>;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function saveEanMap(map: Record<string, string>): void {
  window.localStorage.setItem(EAN_MAP_KEY, JSON.stringify(map));
}

function resolveEan(line: InfaktImportLine, map: Record<string, string>): string {
  if (line.suggestedEan) return line.suggestedEan;
  const key = normalizeText(line.name);
  return map[key] ?? "";
}

function productOptions(query: string) {
  const normalized = normalizeText(query);
  if (!normalized) return LEGACY_PRODUCTS.slice(0, 16);

  return LEGACY_PRODUCTS.filter((product) => {
    const record = product as unknown as Record<string, unknown>;
    const title = String(Object.entries(record).find(([key]) => key !== "ean" && key !== "cena")?.[1] ?? "");
    return normalizeText(`${title} ${product.ean}`).includes(normalized);
  }).slice(0, 16);
}

export function InfaktImportPanel(): JSX.Element {
  const monthDefaults = monthToDateDefault();
  const eventDefaults = eventDateRange();
  const purchaseCosts = useAppStore((state) => state.purchaseCosts);
  const purchaseVatRates = useAppStore((state) => state.purchaseVatRates);
  const stockOverrides = useAppStore((state) => state.stockOverrides);
  const replacePurchaseCosts = useAppStore((state) => state.replacePurchaseCosts);

  const stock = useMemo(() => getResolvedStock(stockOverrides), [stockOverrides]);

  const [sourceMode, setSourceMode] = useState<SourceMode>("infakt");
  const [dateFrom, setDateFrom] = useState(monthDefaults.from);
  const [dateTo, setDateTo] = useState(monthDefaults.to);
  const [status, setStatus] = useState<{ type: "info" | "success" | "error"; message: string } | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [infaktCosts, setInfaktCosts] = useState<InfaktCostSummary[]>([]);
  const [ksefCosts, setKsefCosts] = useState<InfaktKsefSummary[]>([]);
  const [rows, setRows] = useState<DraftRow[]>([]);
  const [eanMap] = useState(loadEanMap);

  const selectedCount = rows.filter((row) => row.selected && row.ean && row.unitNetPrice !== null).length;
  const inStockReadyCount = rows.filter(
    (row) => row.selected && row.ean && row.unitNetPrice !== null && (stock[row.ean] ?? 0) > 0
  ).length;

  function applySelectedRows(selected: DraftRow[], confirmMessage: string, successMessage: string): void {
    if (selected.length === 0) {
      return;
    }

    if (!window.confirm(confirmMessage)) {
      return;
    }

    const nextCosts = { ...purchaseCosts };
    const nextVat = { ...purchaseVatRates };
    const nextMap = { ...loadEanMap() };

    selected.forEach((row) => {
      nextCosts[row.ean] = row.unitNetPrice as number;
      if (row.vatPercent !== null) {
        nextVat[row.ean] = row.vatPercent;
      }
      nextMap[normalizeText(row.name)] = row.ean;
    });

    replacePurchaseCosts(nextCosts, nextVat);
    saveEanMap(nextMap);
    setStatus({ type: "success", message: successMessage });
  }

  async function loadInvoices(mode: SourceMode): Promise<void> {
    setIsLoading(true);
    setStatus(null);

    try {
      if (mode === "infakt") {
        const payload = await listInfaktCosts({ dateFrom, dateTo, limit: 100 });
        const entities = (payload.entities ?? []).filter((item) => {
          const statuses = (item as InfaktCostSummary & { statuses?: Array<{ symbol?: string }> }).statuses;
          return !statuses?.some((entry) => entry.symbol === "cost_rejected");
        });
        setInfaktCosts(entities);
        setStatus({
          type: "success",
          message: `Pobrano ${entities.length} kosztów z inFaktu (ręczne + KSeF w inFakcie).`
        });
      } else {
        const payload = await listInfaktKsefCosts({ dateFrom, dateTo, limit: 100 });
        setKsefCosts(payload.entities ?? []);
        setStatus({
          type: "info",
          message: `Pobrano ${payload.entities?.length ?? 0} faktur kosztowych z KSeF. Limit inFakt: ok. 6 zapytań/h na listę.`
        });
      }
    } catch (error) {
      setStatus({
        type: "error",
        message: error instanceof Error ? error.message : "Nie udało się pobrać dokumentów z inFakt."
      });
    } finally {
      setIsLoading(false);
    }
  }

  async function loadInfaktLines(item: InfaktCostSummary): Promise<void> {
    setIsLoading(true);
    setStatus(null);

    try {
      const payload = await getInfaktCostDetail(item.uuid, {
        ksefNumber: item.ksef_number ?? undefined
      });
      const invoiceLabel = `${item.issue_date} · ${item.number} · ${item.seller_name ?? "dostawca"}`;
      const nextRows = payload.lines.map((line) => ({
        ...line,
        invoiceLabel,
        selected: Boolean(resolveEan(line, eanMap)),
        ean: resolveEan(line, eanMap)
      }));

      setRows((current) => [...current.filter((row) => row.invoiceLabel !== invoiceLabel), ...nextRows]);

      const usedFallback = nextRows.some((row) => row.source === "infakt-cost" || row.source === "infakt-ksef");
      setStatus({
        type: usedFallback ? "info" : "success",
        message: usedFallback
          ? `Wczytano tylko ${nextRows.length} pozycję zbiorczą z ${item.number}. Sprawdź zakładkę „KSeF (API)” albo ponów „Pozycje” po odświeżeniu strony.`
          : `Załadowano ${nextRows.length} pozycji z ${item.number}.`
      });
    } catch (error) {
      setStatus({
        type: "error",
        message: error instanceof Error ? error.message : "Nie udało się wczytać pozycji kosztu."
      });
    } finally {
      setIsLoading(false);
    }
  }

  async function loadKsefLines(item: InfaktKsefSummary): Promise<void> {
    const ksefNumber = item.ksef_number ?? item.number;
    if (!ksefNumber) return;

    setIsLoading(true);
    setStatus(null);

    try {
      const payload = await getInfaktKsefCostLines(ksefNumber);
      const invoiceLabel = `${item.issue_date ?? "?"} · KSeF ${ksefNumber}`;
      const nextRows = payload.lines.map((line) => ({
        ...line,
        invoiceLabel,
        selected: Boolean(resolveEan(line, eanMap)),
        ean: resolveEan(line, eanMap)
      }));

      setRows((current) => [...current.filter((row) => row.invoiceLabel !== invoiceLabel), ...nextRows]);
      setStatus({ type: "success", message: `Załadowano ${nextRows.length} pozycji z KSeF ${ksefNumber}.` });
    } catch (error) {
      setStatus({
        type: "error",
        message: error instanceof Error ? error.message : "Nie udało się wczytać XML z KSeF."
      });
    } finally {
      setIsLoading(false);
    }
  }

  function updateRow(id: string, patch: Partial<DraftRow>): void {
    setRows((current) => current.map((row) => (row.id === id ? { ...row, ...patch } : row)));
  }

  function applyImport(): void {
    const selected = rows.filter((row) => row.selected && row.ean && row.unitNetPrice !== null);
    if (selected.length === 0) {
      setStatus({ type: "error", message: "Zaznacz pozycje z przypisanym EAN i ceną netto." });
      return;
    }

    applySelectedRows(
      selected,
      `Import zaktualizuje koszty zakupu dla ${selected.length} pozycji (połączy z obecnymi danymi). Kontynuować?`,
      `Zaimportowano ${selected.length} kosztów zakupu z inFakt/KSeF.`
    );
  }

  function applyImportInStockOnly(): void {
    const selected = rows.filter(
      (row) => row.selected && row.ean && row.unitNetPrice !== null && (stock[row.ean] ?? 0) > 0
    );

    if (selected.length === 0) {
      setStatus({
        type: "error",
        message: "Brak zaznaczonych pozycji z EAN, ceną netto i stanem magazynowym większym niż 0."
      });
      return;
    }

    applySelectedRows(
      selected,
      `Uzupełnić koszty zakupu dla ${selected.length} produktów ze stanem > 0? Istniejące wpisy dla tych EAN zostaną nadpisane.`,
      `Uzupełniono koszty dla ${selected.length} produktów ze stanem magazynowym.`
    );
  }

  const productMatches = useMemo(() => productOptions(""), []);

  return (
    <section className="panel ksef-card">
      <span className="panel-label">Import kosztów z inFakt / KSeF</span>
      <p className="admin-subtitle" style={{ marginTop: ".35rem" }}>
        Pobierz faktury kosztowe z inFaktu (ręczne wpisy i dokumenty zsynchronizowane z KSeF) albo bezpośrednio z KSeF
        przez API inFakt. Następnie przypisz EAN i zatwierdź import do marży.
      </p>

      <div className="ksef-topbar">
        <label className="price-advisor-setting">
          <span>Od</span>
          <input className="ksef-input" type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} />
        </label>
        <label className="price-advisor-setting">
          <span>Do</span>
          <input className="ksef-input" type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} />
        </label>

        <button
          className="btn-ghost"
          type="button"
          onClick={() => {
            setDateFrom(monthDefaults.from);
            setDateTo(monthDefaults.to);
          }}
        >
          Ten miesiąc
        </button>
        <button
          className="btn-ghost"
          type="button"
          onClick={() => {
            setDateFrom(eventDefaults.from);
            setDateTo(eventDefaults.to);
          }}
        >
          Zakres wydarzenia
        </button>

        <div className="client-export-target-toggle" role="group" aria-label="Źródło dokumentów">
          <button
            type="button"
            className={`client-export-target-btn${sourceMode === "infakt" ? " active" : ""}`}
            onClick={() => setSourceMode("infakt")}
          >
            Koszty inFakt
          </button>
          <button
            type="button"
            className={`client-export-target-btn${sourceMode === "ksef" ? " active" : ""}`}
            onClick={() => setSourceMode("ksef")}
          >
            KSeF (API)
          </button>
        </div>

        <button className="btn-search" type="button" disabled={isLoading} onClick={() => void loadInvoices(sourceMode)}>
          {isLoading ? "Pobieram…" : "Pobierz listę"}
        </button>
      </div>

      {status ? (
        <div className={`inventory-status ${status.type}`} style={{ display: "block", marginTop: ".75rem" }} role="status">
          {status.message}
        </div>
      ) : null}

      <div className="ksef-table-wrap" style={{ marginTop: "1rem" }}>
        {sourceMode === "infakt" ? (
          infaktCosts.length === 0 ? (
            <div className="ksef-empty">Pobierz koszty z inFaktu, aby zobaczyć faktury z okresu.</div>
          ) : (
            <table className="ksef-table">
              <thead>
                <tr>
                  <th>Data</th>
                  <th>Numer</th>
                  <th>Dostawca</th>
                  <th>Źródło</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {infaktCosts.map((item) => (
                  <tr key={item.uuid}>
                    <td>{item.issue_date}</td>
                    <td>{item.number}</td>
                    <td>
                      <span className="ksef-line-name">{item.seller_name ?? "—"}</span>
                      {item.seller_tax_code ? (
                        <span className="ksef-line-sub">NIP {item.seller_tax_code}</span>
                      ) : null}
                    </td>
                    <td>{item.source ?? item.kind ?? "—"}</td>
                    <td>
                      <button className="btn-mini" type="button" disabled={isLoading} onClick={() => void loadInfaktLines(item)}>
                        Pozycje
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )
        ) : ksefCosts.length === 0 ? (
          <div className="ksef-empty">Pobierz faktury kosztowe bezpośrednio z KSeF (przez integrację inFakt).</div>
        ) : (
          <table className="ksef-table">
            <thead>
              <tr>
                <th>Data</th>
                <th>Numer KSeF</th>
                <th>Dostawca</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {ksefCosts.map((item) => {
                const ksefNumber = item.ksef_number ?? item.number ?? "";
                return (
                  <tr key={ksefNumber}>
                    <td>{item.issue_date ?? "—"}</td>
                    <td className="mono">{ksefNumber}</td>
                    <td>{item.seller_name ?? "—"}</td>
                    <td>
                      <button
                        className="btn-mini"
                        type="button"
                        disabled={isLoading || !ksefNumber}
                        onClick={() => void loadKsefLines(item)}
                      >
                        XML / pozycje
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {rows.length > 0 ? (
        <>
          <div className="ksef-toolbar">
            <span className="ksef-meta-label">
              Pozycje do mapowania: {rows.length} · gotowe do importu: {selectedCount}
              {inStockReadyCount > 0 ? ` · ze stanem: ${inStockReadyCount}` : ""}
            </span>
            <button className="btn-search" type="button" onClick={applyImportInStockOnly} disabled={inStockReadyCount === 0}>
              Uzupełnij koszty ze stanem ({inStockReadyCount})
            </button>
            <button className="btn-ghost" type="button" onClick={applyImport}>
              Zastosuj do kosztów ({selectedCount})
            </button>
          </div>

          <div className="ksef-table-wrap">
            <table className="ksef-table">
              <thead>
                <tr>
                  <th></th>
                  <th>Faktura</th>
                  <th>Pozycja</th>
                  <th>Ilość</th>
                  <th>Netto/szt.</th>
                  <th>VAT</th>
                  <th>EAN</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={`${row.invoiceLabel}-${row.id}`}>
                    <td>
                      <input
                        className="ksef-checkbox"
                        type="checkbox"
                        checked={row.selected}
                        onChange={(event) => updateRow(row.id, { selected: event.target.checked })}
                      />
                    </td>
                    <td>{row.invoiceLabel}</td>
                    <td>
                      <span className="ksef-line-name">{row.name}</span>
                    </td>
                    <td>{row.qty}</td>
                    <td>{row.unitNetPrice !== null ? row.unitNetPrice.toFixed(2).replace(".", ",") : "—"}</td>
                    <td>{row.vatPercent !== null ? `${row.vatPercent}%` : "—"}</td>
                    <td>
                      <input
                        className="ksef-input"
                        list={`infakt-ean-options-${row.id}`}
                        value={row.ean}
                        placeholder="EAN"
                        onChange={(event) => updateRow(row.id, { ean: event.target.value.replace(/\D/g, "").slice(0, 13) })}
                      />
                      <datalist id={`infakt-ean-options-${row.id}`}>
                        {productMatches.map((product) => {
                          const record = product as unknown as Record<string, unknown>;
                          const title = String(
                            Object.entries(record).find(([key]) => key !== "ean" && key !== "cena")?.[1] ?? ""
                          );
                          return <option key={product.ean} value={product.ean} label={title} />;
                        })}
                      </datalist>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : null}
    </section>
  );
}
