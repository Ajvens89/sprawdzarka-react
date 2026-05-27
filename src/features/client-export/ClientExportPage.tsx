import { type ChangeEvent, useMemo, useState } from "react";
import {
  calcClientControlDiff,
  calcClientLineTotal,
  calcClientListTotal,
  downloadClientGamesExcel,
  parseClientGamesWorkbook,
  type ClientGameLine
} from "../../lib/exportClientGamesExcel";
import { getInventoryEntries, getResolvedProducts, getResolvedStock } from "../../lib/scanner";
import { formatMoney, normalizeText, todayStr, uid } from "../../lib/utils";
import { useAppStore } from "../../store/useAppStore";
import { useClientExportStore } from "../../store/useClientExportStore";
import type { Product } from "../../types/app";

type EditableLine = ClientGameLine & { id: string };
type ListKind = "deduction" | "remaining";

function productTitle(product: Product): string {
  return product.tytuł;
}

function toEditableLine(line: ClientGameLine): EditableLine {
  return { ...line, id: uid("line") };
}

function parseInputNumber(value: string): number | null {
  const normalized = value.replace(",", ".").replace(/[^\d.]/g, "");
  if (!normalized) return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? Math.round(parsed * 100) / 100 : null;
}

function buildStockLines(products: Product[], stock: Record<string, number>): EditableLine[] {
  return products
    .filter((product) => (stock[product.ean] ?? 0) > 0)
    .map((product) =>
      toEditableLine({
        title: productTitle(product),
        qty: stock[product.ean] ?? 0,
        unitPrice: product.cena,
        notes: ""
      })
    )
    .sort((left, right) => left.title.localeCompare(right.title, "pl"));
}

function buildInventoryRemainingLines(
  products: Product[],
  stock: Record<string, number>,
  inventoryCounts: Record<string, number>,
  inventoryVerified: Record<string, boolean>
): EditableLine[] {
  return getInventoryEntries(products, stock, inventoryCounts, inventoryVerified, false)
    .filter((entry) => entry.verified && entry.qty > 0)
    .map((entry) =>
      toEditableLine({
        title: productTitle(entry.product),
        qty: entry.qty,
        unitPrice: entry.product.cena,
        notes: ""
      })
    )
    .sort((left, right) => left.title.localeCompare(right.title, "pl"));
}

function buildSoldLines(
  products: Product[],
  stock: Record<string, number>,
  inventoryCounts: Record<string, number>,
  inventoryVerified: Record<string, boolean>
): EditableLine[] {
  return getInventoryEntries(products, stock, inventoryCounts, inventoryVerified, false)
    .filter((entry) => entry.verified && entry.baseline !== null && entry.baseline > entry.qty)
    .map((entry) => {
      const soldQty = (entry.baseline ?? 0) - entry.qty;
      return toEditableLine({
        title: productTitle(entry.product),
        qty: soldQty,
        unitPrice: entry.product.cena,
        notes: ""
      });
    })
    .sort((left, right) => left.title.localeCompare(right.title, "pl"));
}

const QUICK_ACTIONS = [
  {
    id: "stock",
    icon: "📦",
    title: "Zostało ze stanów",
    description: "Wypełnij listę grami ze stanem magazynowym > 0",
    target: "remaining" as const,
    tone: "green"
  },
  {
    id: "inventory",
    icon: "✓",
    title: "Zostało z inwentaryzacji",
    description: "Weź zweryfikowane stany po wydarzeniu",
    target: "remaining" as const,
    tone: "green"
  },
  {
    id: "sold",
    icon: "🛒",
    title: "Skasowanie ze sprzedaży",
    description: "Produkty sprzedane więcej niż zostało na półce",
    target: "deduction" as const,
    tone: "red"
  },
  {
    id: "import",
    icon: "📂",
    title: "Wczytaj Excel",
    description: "Otwórz istniejący plik gry.xlsx i edytuj",
    target: "import" as const,
    tone: "blue"
  }
] as const;

function ClientGameTable({
  kind,
  heading,
  subtitle,
  items,
  onChange,
  onRemove,
  emptyHint
}: {
  kind: ListKind;
  heading: string;
  subtitle: string;
  items: EditableLine[];
  onChange: (id: string, patch: Partial<ClientGameLine>) => void;
  onRemove: (id: string) => void;
  emptyHint: string;
}): JSX.Element {
  const total = calcClientListTotal(items);

  return (
    <section className={`panel client-export-section client-export-section--${kind}`}>
      <div className="client-export-section-head">
        <div className="client-export-section-title">
          <span className={`client-export-section-badge client-export-section-badge--${kind}`}>
            {kind === "deduction" ? "−" : "+"}
          </span>
          <div>
            <h3>{heading}</h3>
            <p>{subtitle}</p>
          </div>
        </div>
        <div className="client-export-section-total">
          <span>{items.length} poz.</span>
          <strong>{formatMoney(total)}</strong>
        </div>
      </div>

      <div className="report-table-wrap client-export-table-wrap">
        <table className="report-table admin-table client-export-table">
          <thead>
            <tr>
              <th>Gra</th>
              <th className="num">Ilość</th>
              <th className="num">Cena/szt.</th>
              <th className="num">Razem</th>
              <th>Uwagi</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr>
                <td colSpan={6}>
                  <div className="client-export-empty">
                    <span className="client-export-empty-icon" aria-hidden="true">
                      {kind === "deduction" ? "📋" : "🎲"}
                    </span>
                    <p>{emptyHint}</p>
                  </div>
                </td>
              </tr>
            ) : (
              items.map((item) => (
                <tr key={item.id}>
                  <td>
                    <input
                      className="admin-cost-input client-export-title-input"
                      value={item.title}
                      onChange={(event) => onChange(item.id, { title: event.target.value })}
                    />
                  </td>
                  <td className="num">
                    <input
                      className="admin-cost-input client-export-qty-input"
                      inputMode="numeric"
                      value={String(item.qty)}
                      onChange={(event) => {
                        const parsed = parseInputNumber(event.target.value);
                        if (parsed !== null) onChange(item.id, { qty: Math.max(0, Math.round(parsed)) });
                      }}
                    />
                  </td>
                  <td className="num">
                    <input
                      className="admin-cost-input client-export-price-input"
                      inputMode="decimal"
                      value={item.unitPrice.toFixed(2).replace(".", ",")}
                      onChange={(event) => {
                        const parsed = parseInputNumber(event.target.value);
                        if (parsed !== null) onChange(item.id, { unitPrice: parsed });
                      }}
                    />
                  </td>
                  <td className="num client-export-line-total">{formatMoney(calcClientLineTotal(item))}</td>
                  <td>
                    <input
                      className="admin-cost-input client-export-notes-input"
                      value={item.notes ?? ""}
                      placeholder="Opcjonalnie"
                      onChange={(event) => onChange(item.id, { notes: event.target.value })}
                    />
                  </td>
                  <td>
                    <button
                      className="btn-mini client-export-remove-btn"
                      type="button"
                      onClick={() => onRemove(item.id)}
                      aria-label={`Usuń ${item.title}`}
                    >
                      ✕
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
          {items.length > 0 ? (
            <tfoot>
              <tr>
                <td colSpan={3}>Razem</td>
                <td className="num">{formatMoney(total)}</td>
                <td colSpan={2}></td>
              </tr>
            </tfoot>
          ) : null}
        </table>
      </div>
    </section>
  );
}

export function ClientExportPage(): JSX.Element {
  const stockOverrides = useAppStore((state) => state.stockOverrides);
  const priceOverrides = useAppStore((state) => state.priceOverrides);
  const inventoryCounts = useAppStore((state) => state.inventoryCounts);
  const inventoryVerified = useAppStore((state) => state.inventoryVerified);

  const title = useClientExportStore((state) => state.title);
  const receiptTotalInput = useClientExportStore((state) => state.receiptTotalInput);
  const notes = useClientExportStore((state) => state.notes);
  const deductionItems = useClientExportStore((state) => state.deductionItems);
  const remainingItems = useClientExportStore((state) => state.remainingItems);
  const targetList = useClientExportStore((state) => state.targetList);
  const setTitle = useClientExportStore((state) => state.setTitle);
  const setReceiptTotalInput = useClientExportStore((state) => state.setReceiptTotalInput);
  const setNotes = useClientExportStore((state) => state.setNotes);
  const setTargetList = useClientExportStore((state) => state.setTargetList);
  const setDeductionItems = useClientExportStore((state) => state.setDeductionItems);
  const setRemainingItems = useClientExportStore((state) => state.setRemainingItems);
  const updateLine = useClientExportStore((state) => state.updateLine);
  const removeLine = useClientExportStore((state) => state.removeLine);
  const appendLine = useClientExportStore((state) => state.appendLine);

  const stock = useMemo(() => getResolvedStock(stockOverrides), [stockOverrides]);
  const products = useMemo(() => getResolvedProducts(priceOverrides), [priceOverrides]);

  const [productQuery, setProductQuery] = useState("");
  const [status, setStatus] = useState<{ type: "info" | "success" | "error"; message: string } | null>(null);
  const importInputId = "client-export-import-input";

  const receiptTotal = parseInputNumber(receiptTotalInput) ?? 0;
  const deductionTotal = calcClientListTotal(deductionItems);
  const remainingTotal = calcClientListTotal(remainingItems);
  const controlDiff = calcClientControlDiff(receiptTotal, deductionTotal, remainingTotal);
  const isBalanced = controlDiff === 0 && receiptTotal > 0;

  const matchingProducts = useMemo(() => {
    const query = normalizeText(productQuery);
    if (!query) return products.slice(0, 12);

    return products
      .filter(
        (product) =>
          normalizeText(productTitle(product)).includes(query) || product.ean.includes(productQuery.replace(/\D/g, ""))
      )
      .slice(0, 12);
  }, [productQuery, products]);

  function addProduct(product: Product): void {
    const line = toEditableLine({
      title: productTitle(product),
      qty: stock[product.ean] ?? 1,
      unitPrice: product.cena,
      notes: ""
    });

    appendLine(targetList, line);

    setStatus({ type: "success", message: `Dodano „${productTitle(product)}” do listy ${targetList === "deduction" ? "Do skasowania" : "Zostało"}.` });
  }

  function handleExport(): void {
    if (deductionItems.length === 0 && remainingItems.length === 0) {
      setStatus({ type: "error", message: "Dodaj pozycje do listy „Do skasowania” lub „Zostało”." });
      return;
    }

    downloadClientGamesExcel({
      title,
      receiptTotal,
      deductionItems,
      remainingItems,
      notes,
      filename: `gry-${todayStr()}.xlsx`
    });
    setStatus({ type: "success", message: "Wygenerowano plik Excel z trzema arkuszami." });
  }

  async function handleImport(event: ChangeEvent<HTMLInputElement>): Promise<void> {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    try {
      const parsed = parseClientGamesWorkbook(await file.arrayBuffer());
      if (parsed.deductionItems.length > 0) {
        setDeductionItems(parsed.deductionItems.map(toEditableLine));
      }
      if (parsed.remainingItems.length > 0) {
        setRemainingItems(parsed.remainingItems.map(toEditableLine));
      }
      if (parsed.receiptTotal !== null) {
        setReceiptTotalInput(String(parsed.receiptTotal).replace(".", ","));
      }
      setStatus({
        type: "success",
        message: `Wczytano ${parsed.deductionItems.length} poz. do skasowania i ${parsed.remainingItems.length} poz. „Zostało”.`
      });
    } catch {
      setStatus({ type: "error", message: "Nie udało się wczytać pliku Excel." });
    }
  }

  function runQuickAction(actionId: (typeof QUICK_ACTIONS)[number]["id"]): void {
    if (actionId === "stock") {
      const lines = buildStockLines(products, stock);
      setRemainingItems(lines);
      setStatus({ type: "success", message: `Uzupełniono „Zostało” ze stanów magazynowych (${lines.length} poz.).` });
      return;
    }

    if (actionId === "inventory") {
      const lines = buildInventoryRemainingLines(products, stock, inventoryCounts, inventoryVerified);
      setRemainingItems(lines);
      setStatus({ type: "success", message: `Uzupełniono „Zostało” z inwentaryzacji (${lines.length} poz.).` });
      return;
    }

    if (actionId === "sold") {
      const lines = buildSoldLines(products, stock, inventoryCounts, inventoryVerified);
      setDeductionItems(lines);
      setStatus({ type: "success", message: `Uzupełniono „Do skasowania” ze sprzedanych sztuk (${lines.length} poz.).` });
    }
  }

  return (
    <div className="client-export-page">
      <section className="client-export-hero panel">
        <div className="client-export-hero-copy">
          <span className="client-export-badge">Eksport klienta</span>
          <h2 className="client-export-title">Excel ze stanami gier</h2>
          <p className="client-export-lead">
            Przygotuj rozliczenie w formacie <strong>gry.xlsx</strong> — trzy arkusze, sumy i kontrola różnicy.
          </p>

          <div className="client-export-sheets" aria-label="Struktura pliku Excel">
            <span className="client-export-sheet-pill">📊 Podsumowanie</span>
            <span className="client-export-sheet-pill client-export-sheet-pill--deduction">− Do skasowania</span>
            <span className="client-export-sheet-pill client-export-sheet-pill--remaining">+ Zostało</span>
          </div>
        </div>

        <div className={`client-export-balance ${isBalanced ? "is-balanced" : controlDiff !== 0 ? "is-warning" : ""}`}>
          <span className="client-export-balance-label">Różnica kontrolna</span>
          <strong>{formatMoney(controlDiff)}</strong>
          <span className="client-export-balance-hint">
            {isBalanced ? "✓ Rozliczenie się zgadza" : controlDiff !== 0 ? "Sprawdź sumy — powinno wyjść 0 zł" : "Uzupełnij sumę paragonu i listy"}
          </span>
        </div>
      </section>

      <section className="bistro-summary client-export-kpis" aria-label="Podsumowanie kwot">
        <div className="bistro-kpi revenue">
          <div className="bistro-kpi-label">Suma paragonu</div>
          <div className="bistro-kpi-value">{receiptTotal > 0 ? formatMoney(receiptTotal) : "—"}</div>
        </div>
        <div className="bistro-kpi cost">
          <div className="bistro-kpi-label">Do skasowania</div>
          <div className="bistro-kpi-value">{formatMoney(deductionTotal)}</div>
        </div>
        <div className="bistro-kpi profit">
          <div className="bistro-kpi-label">Zostało</div>
          <div className="bistro-kpi-value">{formatMoney(remainingTotal)}</div>
        </div>
        <div className={`bistro-kpi margin${isBalanced ? " is-ok" : ""}`}>
          <div className="bistro-kpi-label">Pozycji łącznie</div>
          <div className="bistro-kpi-value">{deductionItems.length + remainingItems.length}</div>
        </div>
      </section>

      <div className="client-export-grid">
        <section className="panel client-export-card">
          <div className="client-export-card-head">
            <span className="panel-label">Ustawienia dokumentu</span>
          </div>

          <div className="client-export-form">
            <label className="client-export-field">
              <span>Tytuł w Excelu</span>
              <input value={title} onChange={(event) => setTitle(event.target.value)} />
            </label>

            <label className="client-export-field">
              <span>Suma paragonu [zł]</span>
              <input
                className="client-export-field--money"
                inputMode="decimal"
                placeholder="np. 6929"
                value={receiptTotalInput}
                onChange={(event) => setReceiptTotalInput(event.target.value)}
              />
            </label>

            <label className="client-export-field client-export-field--full">
              <span>Uwagi (opcjonalnie)</span>
              <textarea rows={3} value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Np. wyjaśnienie rozbicia cen..." />
            </label>
          </div>

          <button className="btn-search client-export-download-btn" type="button" onClick={handleExport}>
            <span aria-hidden="true">⬇</span> Pobierz Excel
          </button>
        </section>

        <section className="panel client-export-card">
          <div className="client-export-card-head">
            <span className="panel-label">Szybkie wypełnianie</span>
          </div>

          <div className="client-export-actions">
            {QUICK_ACTIONS.map((action) =>
              action.id === "import" ? (
                <label
                  key={action.id}
                  className={`client-export-action client-export-action--${action.tone}`}
                  htmlFor={importInputId}
                >
                  <span className="client-export-action-icon" aria-hidden="true">
                    {action.icon}
                  </span>
                  <span className="client-export-action-copy">
                    <strong>{action.title}</strong>
                    <small>{action.description}</small>
                  </span>
                </label>
              ) : (
                <button
                  key={action.id}
                  className={`client-export-action client-export-action--${action.tone}`}
                  type="button"
                  onClick={() => runQuickAction(action.id)}
                >
                  <span className="client-export-action-icon" aria-hidden="true">
                    {action.icon}
                  </span>
                  <span className="client-export-action-copy">
                    <strong>{action.title}</strong>
                    <small>{action.description}</small>
                  </span>
                </button>
              )
            )}
          </div>

          <input
            id={importInputId}
            type="file"
            accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            hidden
            onChange={(event) => void handleImport(event)}
          />
        </section>
      </div>

      {status ? (
        <div className={`client-export-toast client-export-toast--${status.type}`} role="status">
          {status.message}
        </div>
      ) : null}

      <section className="panel client-export-picker">
        <div className="client-export-picker-head">
          <div>
            <span className="panel-label">Dodaj grę ręcznie</span>
            <p className="client-export-picker-lead">Wyszukaj produkt i dodaj go do wybranej listy.</p>
          </div>

          <div className="client-export-target-toggle" role="group" aria-label="Docelowa lista">
            <button
              type="button"
              className={`client-export-target-btn${targetList === "deduction" ? " active" : ""}`}
              onClick={() => setTargetList("deduction")}
            >
              Do skasowania
            </button>
            <button
              type="button"
              className={`client-export-target-btn${targetList === "remaining" ? " active" : ""}`}
              onClick={() => setTargetList("remaining")}
            >
              Zostało
            </button>
          </div>
        </div>

        <div className="search-input-wrap client-export-search">
          <span className="search-icon" aria-hidden="true">
            &#9906;
          </span>
          <input
            value={productQuery}
            onChange={(event) => setProductQuery(event.target.value)}
            placeholder="Szukaj gry lub EAN..."
          />
        </div>

        <div className="client-export-product-list">
          {matchingProducts.map((product) => (
            <button key={product.ean} className="client-export-product-card" type="button" onClick={() => addProduct(product)}>
              <span className="client-export-product-add" aria-hidden="true">
                +
              </span>
              <span className="client-export-product-copy">
                <strong>{productTitle(product)}</strong>
                <small>
                  {stock[product.ean] ?? 0} szt. · {formatMoney(product.cena)}
                </small>
              </span>
            </button>
          ))}
        </div>
      </section>

      <div className="client-export-lists">
        <ClientGameTable
          kind="deduction"
          heading="Do skasowania klienta"
          subtitle="Gry, które klient odbiera lub kasuje z rozliczenia"
          items={deductionItems}
          onChange={(id, patch) => updateLine("deduction", id, patch)}
          onRemove={(id) => removeLine("deduction", id)}
          emptyHint="Dodaj gry ręcznie, wczytaj Excel albo użyj „Skasowanie ze sprzedaży”."
        />

        <ClientGameTable
          kind="remaining"
          heading="Zostało"
          subtitle="Gry pozostające po odjęciu listy klienta"
          items={remainingItems}
          onChange={(id, patch) => updateLine("remaining", id, patch)}
          onRemove={(id) => removeLine("remaining", id)}
          emptyHint='Użyj „Zostało ze stanów” albo „Zostało z inwentaryzacji”, albo dodaj gry ręcznie.'
        />
      </div>
    </div>
  );
}
