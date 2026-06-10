import { type ChangeEvent, useEffect, useMemo, useState } from "react";
import { StatusPill } from "../../components/ui/StatusPill";
import { LEGACY_PRODUCTS, getResolvedProducts, getResolvedStock } from "../../lib/scanner";
import { xlsxDownload } from "../../lib/export";
import { formatMoney, normalizeText } from "../../lib/utils";
import { useAppStore } from "../../store/useAppStore";
import type { PriceEntry } from "../../types/app";
import { fetchOnlinePrice } from "../../lib/priceCheck";
import { DEFAULT_PRICE_CACHE_HOURS, isPriceEntryFresh } from "../../lib/priceCheckCache";
import { PriceDetailModal } from "../pricing/components/PriceDetailModal";
import { useMarketPriceBatch } from "../pricing/hooks/useMarketPriceBatch";
import { parsePrice, priceStatusLabel, productTitle, type PriceRowStatus } from "../pricing/pricingUtils";

const STORAGE_KEY = "sprawdzarka-price-advisor-v1";
const EXPORT_VERSION = 1;

function loadEntries(): Record<string, PriceEntry> {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, PriceEntry>;
    if (!parsed || typeof parsed !== "object") return {};

    return Object.fromEntries(
      Object.entries(parsed).filter(([, entry]) => {
        if (entry.source === "DuckDuckGo") return false;
        if (!entry.marketPrice && entry.status?.includes("Nie znaleziono")) return false;
        return true;
      })
    );
  } catch {
    return {};
  }
}

function cleanEntries(entries: Record<string, PriceEntry>): Record<string, PriceEntry> {
  return Object.fromEntries(
    Object.entries(entries).filter(([, entry]) => entry.marketPrice || entry.source || entry.checkedAt || entry.status)
  );
}

function downloadTextFile(filename: string, content: string, type: string): void {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function todayStamp(): string {
  return new Date().toISOString().slice(0, 10);
}

function statusVariant(status: PriceRowStatus): "ok" | "warning" | "error" | "muted" {
  if (status === "missing") return "muted";
  if (status === "too-high") return "error";
  if (status === "low") return "ok";
  return "ok";
}

export function PriceAdvisorPage({ embedded = false }: { embedded?: boolean }): JSX.Element {
  const [filter, setFilter] = useState("");
  const [maxAboveMarket, setMaxAboveMarket] = useState(5);
  const [belowMarket, setBelowMarket] = useState(0);
  const [verifying, setVerifying] = useState<Record<string, boolean>>({});
  const [onlyInStock, setOnlyInStock] = useState(false);
  const [detailEan, setDetailEan] = useState<string | null>(null);
  const stockOverrides = useAppStore((state) => state.stockOverrides);
  const priceOverrides = useAppStore((state) => state.priceOverrides);
  const entries = useAppStore((state) => state.priceEntries);
  const approvePriceOverrides = useAppStore((state) => state.approvePriceOverrides);
  const setPriceEntry = useAppStore((state) => state.setPriceEntry);
  const replacePriceEntries = useAppStore((state) => state.replacePriceEntries);
  const stock = useMemo(() => getResolvedStock(stockOverrides), [stockOverrides]);
  const products = useMemo(() => getResolvedProducts(priceOverrides), [priceOverrides]);

  useEffect(() => {
    if (Object.keys(entries).length > 0) return;

    const legacyEntries = loadEntries();
    if (Object.keys(legacyEntries).length > 0) {
      replacePriceEntries(legacyEntries);
      window.localStorage.removeItem(STORAGE_KEY);
    }
  }, [entries, replacePriceEntries]);

  function updateEntry(ean: string, patch: Partial<PriceEntry>): void {
    const nextEntry = {
      marketPrice: entries[ean]?.marketPrice ?? "",
      source: entries[ean]?.source ?? "",
      checkedAt: entries[ean]?.checkedAt,
      status: entries[ean]?.status,
      ...patch
    };

    setPriceEntry(ean, nextEntry);
  }

  async function verifyProduct(product: (typeof LEGACY_PRODUCTS)[number], options?: { force?: boolean }): Promise<void> {
    const existingEntry = useAppStore.getState().priceEntries[product.ean];
    if (!options?.force && isPriceEntryFresh(existingEntry, DEFAULT_PRICE_CACHE_HOURS)) {
      return;
    }

    setVerifying((state) => ({ ...state, [product.ean]: true }));

    try {
      const result = await fetchOnlinePrice({
        ean: product.ean,
        title: productTitle(product),
        currentPrice: product.cena,
        force: options?.force
      });

      updateEntry(product.ean, {
        marketPrice: result.price ? result.price.toFixed(2).replace(".", ",") : entries[product.ean]?.marketPrice ?? "",
        source: result.source || entries[product.ean]?.source || "",
        checkedAt: new Date().toLocaleString("pl-PL"),
        status: result.message
      });
    } catch {
      updateEntry(product.ean, {
        checkedAt: new Date().toLocaleString("pl-PL"),
        status: "Blad polaczenia z lokalnym sprawdzaniem cen."
      });
    } finally {
      setVerifying((state) => ({ ...state, [product.ean]: false }));
    }
  }

  const rows = useMemo(() => {
    const query = normalizeText(filter);

    return products
      .filter((product) => {
        if (onlyInStock && (stock[product.ean] ?? 0) <= 0) return false;
        if (!query) return true;
        return normalizeText(`${productTitle(product)} ${product.ean}`).includes(query);
      })
      .map((product) => {
        const stockQty = stock[product.ean] ?? 0;
        const entry = entries[product.ean] ?? { marketPrice: "", source: "" };
        const marketPrice = parsePrice(entry.marketPrice);
        const priceTarget = marketPrice ? marketPrice * (1 - belowMarket / 100) : null;
        const priceLimit = priceTarget ? priceTarget * (1 + maxAboveMarket / 100) : null;
        const suggestedPrice = priceLimit && product.cena > priceLimit ? Number(priceLimit.toFixed(2)) : product.cena;
        const difference = marketPrice ? product.cena - marketPrice : null;
        const status: PriceRowStatus =
          !marketPrice ? "missing" : product.cena > suggestedPrice ? "too-high" : priceTarget && product.cena < priceTarget * 0.9 ? "low" : "ok";

        return {
          product,
          entry,
          stockQty,
          marketPrice,
          priceTarget,
          suggestedPrice,
          difference,
          status
        };
      });
  }, [belowMarket, entries, filter, maxAboveMarket, onlyInStock, products, stock]);

  const staleVisibleProducts = useMemo(
    () =>
      rows
        .filter((row) => !isPriceEntryFresh(row.entry, DEFAULT_PRICE_CACHE_HOURS))
        .slice(0, 20)
        .map((row) => row.product),
    [rows]
  );

  const {
    compareProgress,
    compareStatus,
    compareInStockPrices,
    cancelCompareInStockPrices
  } = useMarketPriceBatch(staleVisibleProducts);

  function approveProposedChanges(): void {
    const changes = Object.fromEntries(
      rows
        .filter((row) => row.status === "too-high" && row.suggestedPrice < row.product.cena)
        .map((row) => [row.product.ean, row.suggestedPrice])
    );

    if (Object.keys(changes).length === 0) {
      window.alert("Brak proponowanych zmian do zatwierdzenia.");
      return;
    }

    if (
      !window.confirm(
        `Zatwierdzić sugerowane ceny dla ${Object.keys(changes).length} produktów? Możesz je później edytować ręcznie.`
      )
    ) {
      return;
    }

    approvePriceOverrides(changes);
  }

  function exportJson(): void {
    const payload = {
      version: EXPORT_VERSION,
      exportedAt: new Date().toISOString(),
      entries: cleanEntries(entries)
    };

    downloadTextFile(
      `sprawdzarka-ceny-${todayStamp()}.json`,
      JSON.stringify(payload, null, 2),
      "application/json;charset=utf-8"
    );
  }

  function exportExcel(): void {
    const exportRows = rows
      .filter((row) => row.entry.marketPrice || row.entry.source || row.entry.checkedAt || row.entry.status)
      .map((row) => [
        productTitle(row.product),
        row.product.ean,
        row.stockQty,
        row.product.cena,
        row.entry.marketPrice,
        row.entry.source,
        row.entry.checkedAt ?? "",
        row.entry.status ?? "",
        row.suggestedPrice
      ]);

    xlsxDownload(
      [
        ["Produkt", "EAN", "Stan", "Nasza cena", "Cena w internecie", "Zrodlo", "Ostatnio", "Status", "Cena sugerowana"],
        ...exportRows
      ],
      `sprawdzarka-ceny-${todayStamp()}.xlsx`,
      "Ceny"
    );
  }

  function exportChangesExcel(): void {
    const changeRows = rows
      .filter((row) => row.status === "too-high" && row.suggestedPrice < row.product.cena)
      .map((row) => [
        productTitle(row.product),
        row.product.ean,
        row.stockQty,
        row.product.cena,
        row.suggestedPrice,
        row.entry.marketPrice,
        row.entry.source,
        Number((row.product.cena - row.suggestedPrice).toFixed(2)),
        row.entry.checkedAt ?? ""
      ]);

    xlsxDownload(
      [
        ["Produkt", "EAN", "Stan", "Stara cena", "Nowa cena", "Cena w internecie", "Zrodlo", "Obnizka", "Ostatnio"],
        ...changeRows
      ],
      `sprawdzarka-zmiany-cen-${todayStamp()}.xlsx`,
      "Zmiany cen"
    );
  }

  async function importJson(event: ChangeEvent<HTMLInputElement>): Promise<void> {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    try {
      const text = await file.text();
      const parsed = JSON.parse(text) as { entries?: Record<string, PriceEntry> } | Record<string, PriceEntry>;
      const importedEntries = "entries" in parsed ? parsed.entries : parsed;

      if (!importedEntries || typeof importedEntries !== "object") {
        throw new Error("Brak danych cen w pliku.");
      }

      const knownEans = new Set(LEGACY_PRODUCTS.map((product) => product.ean));
      const next = cleanEntries({
        ...entries,
        ...Object.fromEntries(
          Object.entries(importedEntries).filter(([ean, entry]) => {
            return knownEans.has(ean) && entry && typeof entry === "object";
          })
        )
      });

      replacePriceEntries(next);
    } catch {
      window.alert("Nie udało się wczytać cen. Wybierz plik JSON wyeksportowany z tej aplikacji.");
    }
  }

  const checkedCount = rows.filter((row) => row.marketPrice).length;
  const tooHighCount = rows.filter((row) => row.status === "too-high").length;
  const okCount = rows.filter((row) => row.status === "ok" || row.status === "low").length;
  const proposedChangeCount = rows.filter((row) => row.status === "too-high" && row.suggestedPrice < row.product.cena).length;
  const availableCount = LEGACY_PRODUCTS.filter((product) => (stock[product.ean] ?? 0) > 0).length;
  const detailRow = detailEan ? rows.find((row) => row.product.ean === detailEan) ?? null : null;

  return (
    <div className={`price-advisor${embedded ? " price-advisor--embedded" : ""}`}>
      {!embedded ? (
      <section className="price-advisor-header">
        <div>
          <span className="panel-label">Porownywarka cen</span>
          <h2 className="price-advisor-title">Kontrola cen internetowych</h2>
        </div>

        <div className="price-advisor-summary" aria-label="Podsumowanie cen">
          <div>
            <span>Sprawdzone</span>
            <strong>{checkedCount}</strong>
          </div>
          <div>
            <span>Za drogo</span>
            <strong>{tooHighCount}</strong>
          </div>
          <div>
            <span>OK</span>
            <strong>{okCount}</strong>
          </div>
        </div>
      </section>
      ) : null}

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
          title={`${availableCount} z ${LEGACY_PRODUCTS.length} produktow ma stan wiekszy od zera`}
        >
          Tylko ze stanem
        </button>

        <label className="price-advisor-setting">
          <span>Maksymalnie powyzej internetu</span>
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
          <span>Maksymalnie ponizej internetu</span>
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
            disabled={compareProgress !== null || staleVisibleProducts.length === 0}
            onClick={() => void compareInStockPrices()}
          >
            {compareProgress
              ? `Sprawdzam… ${compareProgress.done}/${compareProgress.total}`
              : "Sprawdź brakujące ceny"}
          </button>

          {compareProgress ? (
            <button className="btn-ghost" type="button" onClick={cancelCompareInStockPrices}>
              Przerwij
            </button>
          ) : null}

          <button className="btn-search" type="button" onClick={approveProposedChanges} disabled={proposedChangeCount === 0}>
            Zatwierdź sugerowane ceny
          </button>
        </div>

        {compareStatus ? (
          <div className={`inventory-status ${compareStatus.type}`} style={{ display: "block" }} role="status">
            {compareStatus.message}
          </div>
        ) : null}

        <div className="price-actions-group">
          <button className="btn-ghost" type="button" onClick={exportJson}>
            Eksport JSON
          </button>

          <button className="btn-ghost" type="button" onClick={exportExcel}>
            Eksport Excel
          </button>

          <button className="btn-ghost" type="button" onClick={exportChangesExcel}>
            Eksport zmian
          </button>

          <label className="btn-ghost price-import-button">
            Import JSON
            <input type="file" accept="application/json,.json" onChange={(event) => void importJson(event)} />
          </label>
        </div>
      </section>

      <section className={`panel price-advisor-list${embedded ? " price-advisor-list--compact" : ""}`}>
        {embedded ? (
          <div className="data-table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Produkt</th>
                  <th>EAN</th>
                  <th>Nasza cena</th>
                  <th>Status</th>
                  <th>Cena online</th>
                  <th aria-label="Akcje" />
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.product.ean}>
                    <td className="data-table__sticky">{productTitle(row.product)}</td>
                    <td className="mono">{row.product.ean}</td>
                    <td>{formatMoney(row.product.cena)}</td>
                    <td>
                      <StatusPill
                        variant={statusVariant(row.status)}
                        hint={row.status === "missing" ? "Kliknij „Szczegóły”, aby wpisać lub sprawdzić cenę online." : undefined}
                      >
                        {priceStatusLabel(row.status)}
                      </StatusPill>
                    </td>
                    <td>{row.entry.marketPrice || "—"}</td>
                    <td>
                      <button className="btn-ghost" type="button" onClick={() => setDetailEan(row.product.ean)}>
                        Szczegóły
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
        rows.map(({ product, entry, stockQty, marketPrice, priceTarget, suggestedPrice, difference, status }) => (
          <article className={`price-row ${status}`} key={product.ean}>
            <div className="price-row-main">
              <div className="price-row-title">{productTitle(product)}</div>
              <div className="price-row-meta">
                <span>EAN {product.ean}</span>
                <span>Nasza cena: {formatMoney(product.cena)}</span>
                <span>Stan: {stockQty} szt.</span>
              </div>
            </div>

            <div className="price-row-actions">
              <button className="btn-ghost" type="button" onClick={() => setDetailEan(product.ean)}>
                Szczegóły
              </button>
              <button
                className="btn-search"
                type="button"
                onClick={() => void verifyProduct(product, { force: true })}
                disabled={Boolean(verifying[product.ean])}
              >
                {verifying[product.ean] ? "Sprawdzam..." : "Zweryfikuj"}
              </button>
            </div>

            <div className="price-row-result">
              {!marketPrice ? (
                <span className="price-status muted">Brak danych</span>
              ) : status === "too-high" ? (
                <>
                  <span className="price-status danger">Obniz do {formatMoney(suggestedPrice)}</span>
                  <span className="price-difference">Roznica: +{formatMoney(Math.max(0, difference ?? 0))}</span>
                  {priceTarget ? <span className="price-check-note">Cel: {formatMoney(priceTarget)}</span> : null}
                </>
              ) : status === "low" ? (
                <span className="price-status success">Cena atrakcyjna</span>
              ) : (
                <span className="price-status success">Cena w normie</span>
              )}
              {entry.status ? <span className="price-check-note">{entry.status}</span> : null}
              {entry.checkedAt ? <span className="price-check-note">Ostatnio: {entry.checkedAt}</span> : null}
            </div>
          </article>
        ))
        )}
      </section>

      {detailRow ? (
        <PriceDetailModal
          row={detailRow}
          verifying={Boolean(verifying[detailRow.product.ean])}
          onClose={() => setDetailEan(null)}
          onUpdateEntry={(patch) => updateEntry(detailRow.product.ean, patch)}
          onVerify={(options) => void verifyProduct(detailRow.product, options)}
        />
      ) : null}
    </div>
  );
}
