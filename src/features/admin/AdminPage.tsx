import { type ChangeEvent, useMemo, useRef, useState } from "react";
import { xlsxDownload } from "../../lib/export";
import { parsePurchaseCostsWorkbook } from "../../lib/importPurchaseCosts";
import { LEGACY_PRODUCTS, getResolvedProducts, getResolvedStock } from "../../lib/scanner";
import { fetchOnlinePrice } from "../../lib/priceCheck";
import {
  DEFAULT_BELOW_MARKET,
  DEFAULT_MAX_ABOVE_MARKET,
  evaluateMarketPrice,
  marketPriceStatusLabel,
  parseMarketPriceString,
  sleep
} from "../../lib/marketPriceCompare";
import { calcPurchaseNetFromGross, calcRetailMargin, retailSummaryCalc } from "../../lib/retail";
import { downloadJson, formatMoney, normalizeText, readJsonFile } from "../../lib/utils";
import { useAppStore } from "../../store/useAppStore";
import type { CostMap, Product, VatMap } from "../../types/app";
import { useAuth } from "../auth/AuthProvider";
import { AdminSellingPriceInput } from "./AdminSellingPriceInput";
import { InfaktImportPanel } from "./InfaktImportPanel";

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

export function AdminPage(): JSX.Element {
  const { isFirebaseEnabled, user } = useAuth();
  const [filter, setFilter] = useState("");
  const [marginFilter, setMarginFilter] = useState<MarginFilter>("all");
  const [onlyInStock, setOnlyInStock] = useState(false);
  const [compareProgress, setCompareProgress] = useState<{ done: number; total: number } | null>(null);
  const [compareStatus, setCompareStatus] = useState<{ type: "info" | "success" | "error"; message: string } | null>(
    null
  );
  const [maxAboveMarket, setMaxAboveMarket] = useState(DEFAULT_MAX_ABOVE_MARKET);
  const [belowMarket, setBelowMarket] = useState(DEFAULT_BELOW_MARKET);
  const compareCancelRef = useRef(false);

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

  async function compareInStockPrices(): Promise<void> {
    if (inStockProducts.length === 0) {
      setCompareStatus({ type: "error", message: "Brak produktów ze stanem większym niż 0." });
      return;
    }

    if (
      !window.confirm(
        `Porównam ceny online dla ${inStockProducts.length} produktów ze stanem > 0. Operacja może potrwać kilka minut. Kontynuować?`
      )
    ) {
      return;
    }

    setCompareStatus(null);
    setCompareProgress({ done: 0, total: inStockProducts.length });
    compareCancelRef.current = false;

    let checked = 0;
    let found = 0;
    let errors = 0;

    for (let index = 0; index < inStockProducts.length; index += 1) {
      if (compareCancelRef.current) {
        break;
      }

      const product = inStockProducts[index];
      const previousEntry = useAppStore.getState().priceEntries[product.ean];

      try {
        const result = await fetchOnlinePrice({
          ean: product.ean,
          title: productTitle(product),
          currentPrice: product.cena
        });

        if (result.price) {
          found += 1;
        } else {
          errors += 1;
        }

        setPriceEntry(product.ean, {
          marketPrice: result.price ? result.price.toFixed(2).replace(".", ",") : previousEntry?.marketPrice ?? "",
          source: result.source || previousEntry?.source || "",
          checkedAt: new Date().toLocaleString("pl-PL"),
          status: result.message
        });
      } catch {
        errors += 1;
        setPriceEntry(product.ean, {
          marketPrice: previousEntry?.marketPrice ?? "",
          source: previousEntry?.source ?? "",
          checkedAt: new Date().toLocaleString("pl-PL"),
          status: "Błąd połączenia ze sprawdzaniem cen online."
        });
      }

      checked += 1;
      setCompareProgress({ done: checked, total: inStockProducts.length });

      if (index < inStockProducts.length - 1 && !compareCancelRef.current) {
        await sleep(900);
      }
    }

    setCompareProgress(null);
    const wasCancelled = compareCancelRef.current;
    setCompareStatus({
      type: wasCancelled ? "info" : "success",
      message: wasCancelled
        ? `Przerwano po ${checked} z ${inStockProducts.length} produktów. Znaleziono ceny: ${found}, błędy/brak ceny: ${errors}.`
        : `Sprawdzono ${checked} produktów ze stanem. Znaleziono ceny online dla ${found} pozycji, błędy/brak ceny: ${errors}. Możesz poprawić wartości ręcznie w tabeli.`
    });
  }

  function cancelCompareInStockPrices(): void {
    compareCancelRef.current = true;
  }

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

  return (
    <div className="admin-page">
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

      {isFirebaseEnabled && !user ? (
        <div className="banner banner-warning" style={{ marginBottom: "1rem" }} role="status">
          <strong>Brak synchronizacji</strong> — koszty zakupu z komputera nie trafią na telefon, dopóki nie
          klikniesz <strong>Zaloguj</strong> w górnym pasku (ten sam login co na PC).
        </div>
      ) : null}

      {user && summary.withCost === 0 && summary.missingCost > 0 ? (
        <div className="banner banner-warning" style={{ marginBottom: "1rem" }} role="status">
          <strong>Brak kosztów zakupu</strong> — odśwież stronę (Ctrl+F5). Jeśli nadal pusto, wyloguj się i zaloguj
          ponownie, aby pobrać dane z Firebase.
        </div>
      ) : null}

      <div className="bistro-summary admin-kpi-row">
        <div className="bistro-kpi margin">
          <div className="bistro-kpi-label">Srednia marza</div>
          <div className="bistro-kpi-value">
            {summary.avgMarginPct === null ? "—" : `${summary.avgMarginPct.toFixed(1).replace(".", ",")} %`}
          </div>
        </div>
      </div>

      <section className="panel price-advisor-tools">
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

        <label className="price-advisor-setting">
          <span>Filtr marzy</span>
          <select value={marginFilter} onChange={(event) => setMarginFilter(event.target.value as MarginFilter)}>
            <option value="all">Wszystkie</option>
            <option value="with-cost">Tylko z kosztem</option>
            <option value="profit">Zarabiam</option>
            <option value="loss">Tracisz</option>
            <option value="missing-cost">Brak kosztu</option>
          </select>
        </label>

        <label className="price-advisor-setting">
          <span>Maks. powyzej rynku</span>
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
          <span>Maks. ponizej rynku</span>
          <input
            type="number"
            min={0}
            max={50}
            value={belowMarket}
            onChange={(event) => setBelowMarket(Math.max(0, Number(event.target.value) || 0))}
          />
          <span>%</span>
        </label>

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

        <div className="price-actions-group">
          <button className="btn-ghost" type="button" onClick={exportTemplate}>
            Szablon Excel
          </button>
          <button className="btn-ghost" type="button" onClick={exportExcel}>
            Eksport Excel
          </button>
          <button className="btn-ghost" type="button" onClick={exportJson}>
            Eksport JSON
          </button>
          <label className="btn-ghost price-import-button">
            Import Excel
            <input type="file" accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" onChange={(event) => void importExcel(event)} />
          </label>
          <label className="btn-ghost price-import-button">
            Import JSON
            <input type="file" accept="application/json,.json" onChange={(event) => void importJson(event)} />
          </label>
        </div>
      </section>

      {compareStatus ? (
        <div className={`inventory-status ${compareStatus.type}`} style={{ display: "block" }} role="status">
          {compareStatus.message}
        </div>
      ) : null}

      <InfaktImportPanel />

      <section className="panel admin-table-wrap">
        <div className="report-table-wrap">
          <table className="report-table admin-table">
            <thead>
              <tr>
                <th>Produkt</th>
                <th>EAN</th>
                <th className="num">Stan</th>
                <th className="num">Sprzedaz brutto</th>
                <th className="num">Cena online</th>
                <th>Rynek</th>
                <th className="num">VAT</th>
                <th className="num">Zakup brutto</th>
                <th className="num">Marza brutto</th>
                <th className="num">Marza %</th>
                <th>Marza</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ product, purchaseCost, vatPercent, stockQty, margin, entry, marketPrice, market }) => (
                <tr key={product.ean} className={`admin-row admin-row--${margin.status}`}>
                  <td>{productTitle(product)}</td>
                  <td className="mono">{product.ean}</td>
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
                  <td className="num">
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
                  <td>
                    <span className={`admin-status admin-status--market-${market.status}`}>
                      {marketPriceStatusLabel(market.status)}
                    </span>
                  </td>
                  <td className="num">{vatPercent != null ? `${vatPercent.toFixed(0)}%` : "—"}</td>
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
                  <td className="num">
                    {margin.marginPct === null ? "—" : `${margin.marginPct.toFixed(1).replace(".", ",")} %`}
                  </td>
                  <td>
                    <span className={`admin-status admin-status--${margin.status}`}>{marginLabel(margin.status)}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
