import { Fragment, type ChangeEvent, useMemo, useState } from "react";
import { xlsxDownload } from "../../lib/export";
import { parsePurchaseCostsWorkbook } from "../../lib/importPurchaseCosts";
import { LEGACY_PRODUCTS, getResolvedProducts, getResolvedStock } from "../../lib/scanner";
import { DEFAULT_PRICE_CACHE_HOURS } from "../../lib/priceCheckCache";
import {
  DEFAULT_BELOW_MARKET,
  DEFAULT_MAX_ABOVE_MARKET,
  evaluateMarketPrice,
  marketPriceStatusLabel,
  parseMarketPriceString
} from "../../lib/marketPriceCompare";
import { calcPurchaseNetFromGross, calcRetailMargin, retailSummaryCalc } from "../../lib/retail";
import { downloadJson, formatMoney, normalizeText, readJsonFile } from "../../lib/utils";
import { useAppStore } from "../../store/useAppStore";
import type { CostMap, Product, VatMap } from "../../types/app";
import { useAuth } from "../auth/AuthProvider";
import { AdminSellingPriceInput } from "./AdminSellingPriceInput";
import { Link } from "react-router-dom";
import { InfaktImportPanel } from "./InfaktImportPanel";
import { StepGuide } from "../../components/ui/StepGuide";
import { useMarketPriceBatch } from "../pricing/hooks/useMarketPriceBatch";

type MarginFilter = "all" | "with-cost" | "profit" | "loss" | "missing-cost";

const EXPORT_VERSION = 1;

function productTitle(product: Product): string {
  const record = product as unknown as Record<string, unknown>;
  const title = Object.entries(record).find(([key]) => key !== "ean" && key !== "cena")?.[1];
  return String(title ?? "");
}

function parseCostInput(value: string): number | null {
  const normalized = value.replace(",", ".").replace(/[^\d.]/g, "");
  if (!normalized) return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) && parsed >= 0 ? Math.round(parsed * 100) / 100 : null;
}

function marginLabel(status: ReturnType<typeof calcRetailMargin>["status"]): string {
  if (status === "profit") return "Zarabiasz";
  if (status === "loss") return "Tracisz";
  if (status === "break-even") return "Na zero";
  return "Brak kosztu";
}

export function AdminPage({ view = "full" }: { view?: "costs" | "import" | "full" }): JSX.Element {
  const { isFirebaseEnabled, user } = useAuth();
  const [filter, setFilter] = useState("");
  const [marginFilter, setMarginFilter] = useState<MarginFilter>("all");
  const [onlyInStock, setOnlyInStock] = useState(false);
  const [retailConsole, setRetailConsole] = useState(true);
  const [expandedEan, setExpandedEan] = useState<string | null>(null);
  const [maxAboveMarket, setMaxAboveMarket] = useState(DEFAULT_MAX_ABOVE_MARKET);
  const [belowMarket, setBelowMarket] = useState(DEFAULT_BELOW_MARKET);

  const stockOverrides = useAppStore((state) => state.stockOverrides);
  const priceOverrides = useAppStore((state) => state.priceOverrides);
  const priceEntries = useAppStore((state) => state.priceEntries);
  const purchaseCosts = useAppStore((state) => state.purchaseCosts);
  const purchaseVatRates = useAppStore((state) => state.purchaseVatRates);
  const setPurchaseCost = useAppStore((state) => state.setPurchaseCost);
  const replacePurchaseCosts = useAppStore((state) => state.replacePurchaseCosts);
  const setPriceEntry = useAppStore((state) => state.setPriceEntry);
  const approvePriceOverrides = useAppStore((state) => state.approvePriceOverrides);
  const clearPriceOverride = useAppStore((state) => state.clearPriceOverride);

  const stock = useMemo(() => getResolvedStock(stockOverrides), [stockOverrides]);
  const products = useMemo(() => getResolvedProducts(priceOverrides), [priceOverrides]);
  const inStockProducts = useMemo(
    () => products.filter((product) => (stock[product.ean] ?? 0) > 0),
    [products, stock]
  );

  const {
    compareProgress,
    compareStatus,
    setCompareStatus,
    skipFreshPrices,
    setSkipFreshPrices,
    forceRefreshPrices,
    setForceRefreshPrices,
    compareInStockPrices,
    cancelCompareInStockPrices
  } = useMarketPriceBatch(inStockProducts);

  const rows = useMemo(() => {
    const query = normalizeText(filter);

    return products
      .filter((product) => {
        if (onlyInStock && (stock[product.ean] ?? 0) <= 0) return false;
        if (!query) return true;
        return normalizeText(`${productTitle(product)} ${product.ean}`).includes(query);
      })
      .map((product) => {
        const purchaseCost = purchaseCosts[product.ean] ?? null;
        const vatPercent = purchaseVatRates[product.ean] ?? null;
        const margin = calcRetailMargin(product.cena, purchaseCost, vatPercent);
        const entry = priceEntries[product.ean];
        const marketPrice = entry?.marketPrice ? parseMarketPriceString(entry.marketPrice) : null;
        const market = evaluateMarketPrice({
          marketPrice,
          sellingPrice: product.cena,
          maxAboveMarket,
          belowMarket
        });

        return {
          product,
          purchaseCost,
          vatPercent,
          stockQty: stock[product.ean] ?? 0,
          margin,
          entry,
          marketPrice,
          market
        };
      })
      .filter((row) => {
        if (marginFilter === "with-cost") return row.margin.status !== "unknown";
        if (marginFilter === "profit") return row.margin.status === "profit";
        if (marginFilter === "loss") return row.margin.status === "loss";
        if (marginFilter === "missing-cost") return row.margin.status === "unknown";
        return true;
      })
      .sort((left, right) => {
        const leftWeight =
          left.margin.status === "loss" ? 0 : left.margin.status === "unknown" ? 1 : left.margin.status === "break-even" ? 2 : 3;
        const rightWeight =
          right.margin.status === "loss" ? 0 : right.margin.status === "unknown" ? 1 : right.margin.status === "break-even" ? 2 : 3;
        if (leftWeight !== rightWeight) return leftWeight - rightWeight;
        return (left.margin.profit ?? 0) - (right.margin.profit ?? 0);
      });
  }, [belowMarket, filter, marginFilter, maxAboveMarket, onlyInStock, priceEntries, products, purchaseCosts, purchaseVatRates, stock]);

  const suggestedSellingChanges = useMemo(
    () =>
      rows.filter(
        (row) => row.stockQty > 0 && row.market.status === "too-high" && row.market.suggestedPrice < row.product.cena
      ),
    [rows]
  );

  function applySuggestedSellingPrices(): void {
    const changes = Object.fromEntries(
      suggestedSellingChanges.map((row) => [row.product.ean, row.market.suggestedPrice])
    );

    if (Object.keys(changes).length === 0) {
      setCompareStatus({
        type: "info",
        message: "Brak produktów ze stanem, których cena sprzedaży wymaga obniżenia względem rynku."
      });
      return;
    }

    if (
      !window.confirm(
        `Podstawić sugerowane ceny sprzedaży dla ${Object.keys(changes).length} produktów ze stanem? Nadal możesz je edytować ręcznie w tabeli.`
      )
    ) {
      return;
    }

    approvePriceOverrides(changes);
    setCompareStatus({
      type: "success",
      message: `Zaktualizowano ${Object.keys(changes).length} cen sprzedaży według porównania z rynkiem.`
    });
  }

  const summary = useMemo(
    () =>
      retailSummaryCalc(
        products.map((product) => ({
          sellingPrice: product.cena,
          purchaseCost: purchaseCosts[product.ean] ?? null,
          vatPercent: purchaseVatRates[product.ean] ?? null
        }))
      ),
    [products, purchaseCosts, purchaseVatRates]
  );

  function exportJson(): void {
    downloadJson(`sprawdzarka-koszty-${new Date().toISOString().slice(0, 10)}.json`, {
      version: EXPORT_VERSION,
      exportedAt: new Date().toISOString(),
      purchaseCosts,
      purchaseVatRates
    });
  }

  function exportExcel(): void {
    const header = [
      "EAN",
      "Produkt",
      "Cena sprzedazy brutto",
      "Cena online",
      "Status rynku",
      "Sugerowana cena",
      "VAT %",
      "Koszt zakupu brutto",
      "Marza brutto PLN",
      "Marza %",
      "Status marzy"
    ];
    const body = products.map((product) => {
      const purchaseCost = purchaseCosts[product.ean] ?? null;
      const vatPercent = purchaseVatRates[product.ean] ?? null;
      const margin = calcRetailMargin(product.cena, purchaseCost, vatPercent);
      const entry = priceEntries[product.ean];
      const marketPrice = entry?.marketPrice ? parseMarketPriceString(entry.marketPrice) : null;
      const market = evaluateMarketPrice({
        marketPrice,
        sellingPrice: product.cena,
        maxAboveMarket,
        belowMarket
      });

      return [
        product.ean,
        productTitle(product),
        product.cena,
        entry?.marketPrice ?? "",
        marketPriceStatusLabel(market.status),
        market.status === "too-high" ? market.suggestedPrice : "",
        vatPercent ?? "",
        margin.purchaseGross ?? "",
        margin.profit ?? "",
        margin.marginPct ?? "",
        marginLabel(margin.status)
      ];
    });

    xlsxDownload([header, ...body], `sprawdzarka-koszty-${new Date().toISOString().slice(0, 10)}.xlsx`, "Koszty");
  }

  function exportTemplate(): void {
    xlsxDownload(
      [
        ["EAN/ISBN", "tytuł", "cena zakupu netto", "vat"],
        ...products.slice(0, 3).map((product) => [product.ean, productTitle(product), "", ""])
      ],
      "szablon-kosztow-zakupu.xlsx",
      "Szablon"
    );
  }

  async function importJson(event: ChangeEvent<HTMLInputElement>): Promise<void> {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    try {
      const payload = await readJsonFile<{ purchaseCosts?: CostMap; purchaseVatRates?: VatMap; costs?: CostMap; vat?: VatMap }>(file);
      const importedCosts = payload.purchaseCosts ?? payload.costs;
      const importedVat = payload.purchaseVatRates ?? payload.vat;
      if (!importedCosts || typeof importedCosts !== "object") {
        throw new Error("Brak kosztow w pliku.");
      }

      if (
        !window.confirm(
          "Import połączy koszty z pliku z obecnymi danymi. Istniejące wpisy dla tych samych EAN zostaną nadpisane. Kontynuować?"
        )
      ) {
        return;
      }

      replacePurchaseCosts({ ...purchaseCosts, ...importedCosts }, { ...purchaseVatRates, ...(importedVat ?? {}) });
    } catch {
      window.alert("Nie udało się wczytać kosztów. Użyj pliku JSON wyeksportowanego z tej zakładki.");
    }
  }

  async function importExcel(event: ChangeEvent<HTMLInputElement>): Promise<void> {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    try {
      const buffer = await file.arrayBuffer();
      const imported = parsePurchaseCostsWorkbook(buffer);
      if (imported.imported === 0) {
        throw new Error("Nie znaleziono wierszy z EAN i cena zakupu netto.");
      }

      if (
        !window.confirm(
          `Import doda lub nadpisze ${imported.imported} kosztów zakupu z Excela. Kontynuować?`
        )
      ) {
        return;
      }

      replacePurchaseCosts({ ...purchaseCosts, ...imported.costs }, { ...purchaseVatRates, ...imported.vatRates });
      window.alert(`Wczytano ${imported.imported} cen zakupu z Excela.${imported.skipped ? ` Pominięto ${imported.skipped} wierszy bez ceny.` : ""}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Nie udało się wczytać Excela.";
      window.alert(`${message} Uzyj pliku targowego z kolumnami: EAN/ISBN, vat, cena zakupu netto.`);
    }
  }

  const showCostsTable = view === "costs" || view === "full";
  const showImportSection = view === "import" || view === "full";
  const showCompareTools = view === "costs" || view === "full";
  const showFullHeader = view === "full";

  return (
    <div className="admin-page">
      {showFullHeader ? (
      <section className="price-advisor-header">
        <div>
          <span className="panel-label">Administracja</span>
          <h2 className="price-advisor-title">Koszty zakupu i marza</h2>
          <p className="admin-subtitle">
            Wgraj plik targowy Excel z kolumnami EAN/ISBN, vat i cena zakupu netto. Koszt zakupu brutto liczymy z
            netto i VAT. Marza brutto = cena sprzedazy brutto minus koszt zakupu brutto. Przycisk „Porównaj ceny”
            sprawdza ceny online tylko dla produktów ze stanem &gt; 0 — wyniki możesz poprawić ręcznie.
          </p>
        </div>

        <div className="price-advisor-summary" aria-label="Podsumowanie marzy">
          <div>
            <span>Z kosztem</span>
            <strong>{summary.withCost}</strong>
          </div>
          <div>
            <span>Zarabiasz</span>
            <strong>{summary.profitable}</strong>
          </div>
          <div>
            <span>Tracisz</span>
            <strong>{summary.losing}</strong>
          </div>
          <div>
            <span>Bez kosztu</span>
            <strong>{summary.missingCost}</strong>
          </div>
        </div>
      </section>
      ) : null}

      {showFullHeader && isFirebaseEnabled && !user ? (
        <div className="banner banner-warning" style={{ marginBottom: "1rem" }} role="status">
          <strong>Brak synchronizacji</strong> — koszty zakupu z komputera nie trafią na telefon, dopóki nie
          klikniesz <strong>Zaloguj</strong> w Ustawieniach (ten sam login co na PC).
        </div>
      ) : null}

      {user && summary.withCost === 0 && summary.missingCost > 0 ? (
        <div className="banner banner-warning" style={{ marginBottom: "1rem" }} role="status">
          <strong>Brak kosztów zakupu</strong> — odśwież stronę (Ctrl+F5). Jeśli nadal pusto, wyloguj się i zaloguj
          ponownie, aby pobrać dane z Firebase.
        </div>
      ) : null}

      {showCostsTable ? (
      <>
      <div className="bistro-summary admin-kpi-row">
        <div className="bistro-kpi margin">
          <div className="bistro-kpi-label">Srednia marza</div>
          <div className="bistro-kpi-value">
            {summary.avgMarginPct === null ? "—" : `${summary.avgMarginPct.toFixed(1).replace(".", ",")} %`}
          </div>
        </div>
      </div>

      <section className="panel price-advisor-tools admin-tools">
        <div className="admin-tools-row">
          <div className="search-input-wrap">
            <span className="search-icon" aria-hidden="true">&#9906;</span>
            <input
              value={filter}
              onChange={(event) => setFilter(event.target.value)}
              placeholder="Szukaj produktu lub EAN..."
            />
          </div>

          <button
            className={`btn-toggle${onlyInStock ? " active" : ""}`}
            type="button"
            onClick={() => setOnlyInStock((current) => !current)}
            aria-pressed={onlyInStock}
          >
            Tylko ze stanem
          </button>

          {view === "costs" ? (
            <button
              className={`btn-toggle${retailConsole ? " active" : ""}`}
              type="button"
              aria-pressed={retailConsole}
              onClick={() => {
                setRetailConsole((current) => !current);
                setExpandedEan(null);
              }}
            >
              Konsola handlowa
            </button>
          ) : null}

          <label className="price-advisor-setting price-advisor-setting--select">
            <span>Filtr marzy</span>
            <select value={marginFilter} onChange={(event) => setMarginFilter(event.target.value as MarginFilter)}>
              <option value="all">Wszystkie</option>
              <option value="with-cost">Tylko z kosztem</option>
              <option value="profit">Zarabiam</option>
              <option value="loss">Tracisz</option>
              <option value="missing-cost">Brak kosztu</option>
            </select>
          </label>
        </div>

        <div className="admin-tools-row admin-tools-row--market">
          <label className="price-advisor-setting">
            <span>Powyzej rynku</span>
            <input
              type="number"
              min={0}
              max={50}
              value={maxAboveMarket}
              onChange={(event) => setMaxAboveMarket(Math.max(0, Number(event.target.value) || 0))}
            />
            <span>%</span>
          </label>

          <label className="price-advisor-setting">
            <span>Ponizej rynku</span>
            <input
              type="number"
              min={0}
              max={50}
              value={belowMarket}
              onChange={(event) => setBelowMarket(Math.max(0, Number(event.target.value) || 0))}
            />
            <span>%</span>
          </label>

          {showCompareTools ? (
            <>
              <button
                className={`btn-toggle${skipFreshPrices ? " active" : ""}`}
                type="button"
                aria-pressed={skipFreshPrices}
                disabled={forceRefreshPrices}
                onClick={() => setSkipFreshPrices((current) => !current)}
                title={`Nie odpytuj ponownie produktów ze świeżą ceną online (młodszą niż ${DEFAULT_PRICE_CACHE_HOURS} h)`}
              >
                Pomiń świeże ({DEFAULT_PRICE_CACHE_HOURS}h)
              </button>

              <button
                className={`btn-toggle${forceRefreshPrices ? " active" : ""}`}
                type="button"
                aria-pressed={forceRefreshPrices}
                onClick={() => {
                  setForceRefreshPrices((current) => {
                    const next = !current;
                    if (next) {
                      setSkipFreshPrices(false);
                    }
                    return next;
                  });
                }}
                title="Wymuś ponowne sprawdzenie wszystkich produktów (większe zużycie API)"
              >
                Wymuś odświeżenie
              </button>
            </>
          ) : null}
        </div>

        {showCompareTools ? (
        <div className="price-actions-group price-actions-group--primary">
          <button
            className="btn-search"
            type="button"
            disabled={compareProgress !== null || inStockProducts.length === 0}
            onClick={() => void compareInStockPrices()}
          >
            {compareProgress
              ? `Porównuję… ${compareProgress.done}/${compareProgress.total}`
              : `Porównaj ceny (ze stanem · ${inStockProducts.length})`}
          </button>

          {compareProgress ? (
            <button className="btn-ghost" type="button" onClick={cancelCompareInStockPrices}>
              Przerwij
            </button>
          ) : null}

          <button
            className="btn-search"
            type="button"
            disabled={suggestedSellingChanges.length === 0}
            onClick={applySuggestedSellingPrices}
          >
            Podstaw sugerowane ceny ({suggestedSellingChanges.length})
          </button>
        </div>
        ) : null}

        <div className="price-actions-group">
          {view !== "costs" ? (
            <button className="btn-ghost" type="button" onClick={exportTemplate}>
              Szablon Excel
            </button>
          ) : null}
          <button className="btn-ghost" type="button" onClick={exportExcel}>
            Eksport Excel
          </button>
          <button className="btn-ghost" type="button" onClick={exportJson}>
            Eksport JSON
          </button>
          {view !== "costs" ? (
            <>
              <label className="btn-ghost price-import-button">
                Import Excel
                <input type="file" accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" onChange={(event) => void importExcel(event)} />
              </label>
              <label className="btn-ghost price-import-button">
                Import JSON
                <input type="file" accept="application/json,.json" onChange={(event) => void importJson(event)} />
              </label>
            </>
          ) : null}
        </div>
      </section>

      {showCompareTools && compareStatus ? (
        <div className={`inventory-status ${compareStatus.type}`} style={{ display: "block" }} role="status">
          {compareStatus.message}
        </div>
      ) : null}

      <section className={`panel admin-table-wrap${retailConsole && view === "costs" ? " admin-table-wrap--console" : ""}`}>
        <div className="report-table-wrap">
          <table className="report-table admin-table">
            <thead>
              <tr>
                <th className="admin-table__sticky">Produkt</th>
                <th className="admin-table__sticky mono">EAN</th>
                <th className="num">Stan</th>
                <th className="num">Sprzedaż brutto</th>
                <th className={`num admin-col--extended${retailConsole && view === "costs" ? " is-hidden" : ""}`}>Cena online</th>
                <th className={`admin-col--extended${retailConsole && view === "costs" ? " is-hidden" : ""}`}>Rynek</th>
                <th className={`num admin-col--extended${retailConsole && view === "costs" ? " is-hidden" : ""}`}>VAT</th>
                <th className="num">Zakup brutto</th>
                <th className="num">Marża brutto</th>
                <th className={`num admin-col--extended${retailConsole && view === "costs" ? " is-hidden" : ""}`}>Marża %</th>
                <th>Status</th>
                {retailConsole && view === "costs" ? <th aria-label="Szczegóły" /> : null}
              </tr>
            </thead>
            <tbody>
              {rows.map(({ product, purchaseCost, vatPercent, stockQty, margin, entry, marketPrice, market }) => (
                <Fragment key={product.ean}>
                <tr className={`admin-row admin-row--${margin.status}`}>
                  <td className="admin-table__sticky">{productTitle(product)}</td>
                  <td className="admin-table__sticky mono">{product.ean}</td>
                  <td className="num">{stockQty > 0 ? stockQty : "—"}</td>
                  <td className="num">
                    <AdminSellingPriceInput
                      ean={product.ean}
                      currentPrice={product.cena}
                      hasOverride={Object.prototype.hasOwnProperty.call(priceOverrides, product.ean)}
                      onSave={(ean, price) => approvePriceOverrides({ [ean]: price })}
                      onClearOverride={clearPriceOverride}
                    />
                  </td>
                  <td className={`num admin-col--extended${retailConsole && view === "costs" ? " is-hidden" : ""}`}>
                    <input
                      className="admin-cost-input"
                      type="text"
                      inputMode="decimal"
                      value={entry?.marketPrice ?? ""}
                      placeholder="—"
                      title={entry?.source ? `Źródło: ${entry.source}` : "Cena w internecie"}
                      onChange={(event) =>
                        setPriceEntry(product.ean, {
                          marketPrice: event.target.value,
                          source: entry?.source ?? "",
                          checkedAt: entry?.checkedAt,
                          status: entry?.status
                        })
                      }
                    />
                    {market.status === "too-high" && marketPrice !== null ? (
                      <span className="admin-inline-note">→ {formatMoney(market.suggestedPrice)}</span>
                    ) : null}
                  </td>
                  <td className={`admin-col--extended${retailConsole && view === "costs" ? " is-hidden" : ""}`}>
                    <span className={`admin-status admin-status--market-${market.status}`}>
                      {marketPriceStatusLabel(market.status)}
                    </span>
                  </td>
                  <td className={`num admin-col--extended${retailConsole && view === "costs" ? " is-hidden" : ""}`}>{vatPercent != null ? `${vatPercent.toFixed(0)}%` : "—"}</td>
                  <td className="num">
                    <input
                      className="admin-cost-input"
                      type="text"
                      inputMode="decimal"
                      value={
                        margin.purchaseGross != null ? margin.purchaseGross.toFixed(2).replace(".", ",") : ""
                      }
                      placeholder="np. 18,50"
                      title="Koszt zakupu brutto (netto z Excela + VAT)"
                      onChange={(event) => {
                        const parsedGross = parseCostInput(event.target.value);
                        if (event.target.value.trim() === "") {
                          setPurchaseCost(product.ean, null);
                          return;
                        }
                        if (parsedGross !== null) {
                          setPurchaseCost(product.ean, calcPurchaseNetFromGross(parsedGross, vatPercent));
                        }
                      }}
                    />
                  </td>
                  <td className="num">{margin.profit === null ? "—" : formatMoney(margin.profit)}</td>
                  <td className={`num admin-col--extended${retailConsole && view === "costs" ? " is-hidden" : ""}`}>
                    {margin.marginPct === null ? "—" : `${margin.marginPct.toFixed(1).replace(".", ",")} %`}
                  </td>
                  <td>
                    <span className={`admin-status admin-status--${margin.status}`}>{marginLabel(margin.status)}</span>
                  </td>
                  {retailConsole && view === "costs" ? (
                    <td>
                      <button
                        className="btn-ghost"
                        type="button"
                        onClick={() => setExpandedEan((current) => (current === product.ean ? null : product.ean))}
                      >
                        {expandedEan === product.ean ? "Zwiń" : "Szczegóły"}
                      </button>
                    </td>
                  ) : null}
                </tr>
                {retailConsole && view === "costs" && expandedEan === product.ean ? (
                  <tr className="admin-row-details">
                    <td colSpan={8}>
                      <div className="admin-row-details__grid">
                        <span>Cena online: {entry?.marketPrice || "—"}</span>
                        <span>Rynek: {marketPriceStatusLabel(market.status)}</span>
                        <span>VAT: {vatPercent != null ? `${vatPercent.toFixed(0)}%` : "—"}</span>
                        <span>Marża %: {margin.marginPct === null ? "—" : `${margin.marginPct.toFixed(1).replace(".", ",")} %`}</span>
                        {entry?.source ? <span>Źródło: {entry.source}</span> : null}
                      </div>
                    </td>
                  </tr>
                ) : null}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      </>
      ) : null}

      {showImportSection ? (
        <>
          {view === "import" ? (
            <section className="panel">
              <StepGuide
                steps={[
                  {
                    title: "Pobierz szablon Excel",
                    description: "Plik z kolumnami EAN/ISBN, tytuł, cena zakupu netto, VAT.",
                    help: "Przykładowy wiersz: EAN 5902983494492 · tytuł gry · cena netto 45,00 · VAT 23%. Zapisz jako .xlsx i załaduj w kroku 3.",
                    action: (
                      <button className="btn-ghost" type="button" onClick={exportTemplate}>
                        Pobierz szablon
                      </button>
                    )
                  },
                  {
                    title: "Wypełnij koszty zakupu",
                    description: "Dla każdego EAN wpisz cenę netto i stawkę VAT z faktury.",
                    help: "Netto to kwota z faktury przed VAT. VAT wpisz jako liczbę (np. 23). EAN musi być identyczny jak w bazie gier."
                  },
                  {
                    title: "Załaduj plik lub inFakt",
                    description: "Import Excel/JSON albo pobierz faktury z inFakt/KSeF poniżej.",
                    help: "Excel: kolumny EAN, cena netto, VAT. JSON: plik wyeksportowany z tej aplikacji. inFakt/KSeF: ustaw daty i pobierz koszty automatycznie.",
                    action: (
                      <div className="settings-actions">
                        <label className="btn-ghost price-import-button">
                          Import Excel
                          <input type="file" accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" onChange={(event) => void importExcel(event)} />
                        </label>
                        <label className="btn-ghost price-import-button">
                          Import JSON
                          <input type="file" accept="application/json,.json" onChange={(event) => void importJson(event)} />
                        </label>
                      </div>
                    )
                  },
                  {
                    title: "Porównaj ceny ze stanem",
                    description: "Po imporcie przejdź do tabeli kosztów i uruchom porównanie cen online.",
                    help: "W „Koszty i marże” włącz „Konsola handlowa” na co dzień, a pełną tabelę zostaw do analizy cen rynkowych.",
                    action: (
                      <Link className="btn-search" to="/ceny/koszty">
                        Otwórz koszty i marże
                      </Link>
                    )
                  }
                ]}
              />
            </section>
          ) : null}
          <InfaktImportPanel />
        </>
      ) : null}
    </div>
  );
}
