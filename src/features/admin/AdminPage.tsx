import { type ChangeEvent, useMemo, useState } from "react";
import { xlsxDownload } from "../../lib/export";
import { parsePurchaseCostsWorkbook } from "../../lib/importPurchaseCosts";
import { LEGACY_PRODUCTS, getResolvedProducts, getResolvedStock } from "../../lib/scanner";
import { calcPurchaseNetFromGross, calcRetailMargin, retailSummaryCalc } from "../../lib/retail";
import { downloadJson, formatMoney, normalizeText, readJsonFile } from "../../lib/utils";
import { useAppStore } from "../../store/useAppStore";
import type { CostMap, Product, VatMap } from "../../types/app";

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
  const [filter, setFilter] = useState("");
  const [marginFilter, setMarginFilter] = useState<MarginFilter>("all");
  const [onlyInStock, setOnlyInStock] = useState(false);

  const stockOverrides = useAppStore((state) => state.stockOverrides);
  const priceOverrides = useAppStore((state) => state.priceOverrides);
  const purchaseCosts = useAppStore((state) => state.purchaseCosts);
  const purchaseVatRates = useAppStore((state) => state.purchaseVatRates);
  const setPurchaseCost = useAppStore((state) => state.setPurchaseCost);
  const replacePurchaseCosts = useAppStore((state) => state.replacePurchaseCosts);

  const stock = useMemo(() => getResolvedStock(stockOverrides), [stockOverrides]);
  const products = useMemo(() => getResolvedProducts(priceOverrides), [priceOverrides]);

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
        return {
          product,
          purchaseCost,
          vatPercent,
          stockQty: stock[product.ean] ?? 0,
          margin
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
  }, [filter, marginFilter, onlyInStock, products, purchaseCosts, purchaseVatRates, stock]);

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
    const header = ["EAN", "Produkt", "Cena sprzedazy brutto", "VAT %", "Koszt zakupu brutto", "Marza brutto PLN", "Marza %", "Status"];
    const body = products.map((product) => {
      const purchaseCost = purchaseCosts[product.ean] ?? null;
      const vatPercent = purchaseVatRates[product.ean] ?? null;
      const margin = calcRetailMargin(product.cena, purchaseCost, vatPercent);
      return [
        product.ean,
        productTitle(product),
        product.cena,
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
            netto i VAT. Marza brutto = cena sprzedazy brutto minus koszt zakupu brutto.
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

      <section className="panel admin-table-wrap">
        <div className="report-table-wrap">
          <table className="report-table admin-table">
            <thead>
              <tr>
                <th>Produkt</th>
                <th>EAN</th>
                <th className="num">Stan</th>
                <th className="num">Sprzedaz brutto</th>
                <th className="num">VAT</th>
                <th className="num">Zakup brutto</th>
                <th className="num">Marza brutto</th>
                <th className="num">Marza %</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ product, purchaseCost, vatPercent, stockQty, margin }) => (
                <tr key={product.ean} className={`admin-row admin-row--${margin.status}`}>
                  <td>{productTitle(product)}</td>
                  <td className="mono">{product.ean}</td>
                  <td className="num">{stockQty > 0 ? stockQty : "—"}</td>
                  <td className="num">{formatMoney(product.cena)}</td>
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
