import { type ChangeEvent, useEffect, useMemo, useState } from "react";
import { LEGACY_PRODUCTS, getResolvedProducts, getResolvedStock } from "../../lib/scanner";
import { xlsxDownload } from "../../lib/export";
import { formatMoney, normalizeText } from "../../lib/utils";
import { useAppStore } from "../../store/useAppStore";
import type { PriceEntry } from "../../types/app";

type PriceCheckResponse = {
  ok: boolean;
  price: number | null;
  source: string;
  message: string;
};

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

function saveEntries(entries: Record<string, PriceEntry>): void {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
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

function parsePrice(value: string): number | null {
  const normalized = value.replace(",", ".").replace(/[^\d.]/g, "");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function productTitle(product: (typeof LEGACY_PRODUCTS)[number]): string {
  const record = product as unknown as Record<string, unknown>;
  const title = Object.entries(record).find(([key]) => key !== "ean" && key !== "cena")?.[1];
  return String(title ?? "");
}

function searchUrl(product: (typeof LEGACY_PRODUCTS)[number], target: "google" | "ceneo" | "allegro"): string {
  const titleQuery = encodeURIComponent(productTitle(product));
  const fullQuery = encodeURIComponent(`${product.ean} ${productTitle(product)}`);
  if (target === "google") return `https://www.google.pl/search?tbm=shop&q=${fullQuery}`;
  if (target === "ceneo") return `https://www.ceneo.pl/;szukaj-${titleQuery}`;
  return `https://allegro.pl/listing?string=${fullQuery}&description=1`;
}

export function PriceAdvisorPage(): JSX.Element {
  const [filter, setFilter] = useState("");
  const [maxAboveMarket, setMaxAboveMarket] = useState(5);
  const [belowMarket, setBelowMarket] = useState(0);
  const [verifying, setVerifying] = useState<Record<string, boolean>>({});
  const onlyInStock = useAppStore((state) => state.onlyInStock);
  const stockOverrides = useAppStore((state) => state.stockOverrides);
  const priceOverrides = useAppStore((state) => state.priceOverrides);
  const entries = useAppStore((state) => state.priceEntries);
  const toggleOnlyInStock = useAppStore((state) => state.toggleOnlyInStock);
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
    const next = { ...entries, [ean]: nextEntry };
    saveEntries(next);
  }

  async function verifyProduct(product: (typeof LEGACY_PRODUCTS)[number]): Promise<void> {
    setVerifying((state) => ({ ...state, [product.ean]: true }));

    try {
      const params = new URLSearchParams({
        ean: product.ean,
        title: productTitle(product),
        currentPrice: String(product.cena)
      });
      const response = await fetch(`/api/price-check?${params.toString()}`);
      const contentType = response.headers.get("content-type") ?? "";

      if (!contentType.includes("application/json")) {
        updateEntry(product.ean, {
          checkedAt: new Date().toLocaleString("pl-PL"),
          status: "Serwer cen nie jest wdrozony na Firebase. Uruchom: npm run deploy"
        });
        return;
      }

      const result = (await response.json()) as PriceCheckResponse;

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
        const status =
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

  async function verifyVisible(): Promise<void> {
    for (const row of rows.slice(0, 20)) {
      await verifyProduct(row.product);
    }
  }

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
      saveEntries(next);
    } catch {
      window.alert("Nie udalo sie wczytac cen. Wybierz plik JSON wyeksportowany z tej aplikacji.");
    }
  }

  const checkedCount = rows.filter((row) => row.marketPrice).length;
  const tooHighCount = rows.filter((row) => row.status === "too-high").length;
  const okCount = rows.filter((row) => row.status === "ok" || row.status === "low").length;
  const proposedChangeCount = rows.filter((row) => row.status === "too-high" && row.suggestedPrice < row.product.cena).length;
  const availableCount = LEGACY_PRODUCTS.filter((product) => (stock[product.ean] ?? 0) > 0).length;

  return (
    <div className="price-advisor">
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
          onClick={toggleOnlyInStock}
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

        <div className="price-actions-group">
          <button className="btn-search" type="button" onClick={() => void verifyVisible()}>
            Zweryfikuj widoczne
          </button>

          <button className="btn-search" type="button" onClick={approveProposedChanges} disabled={proposedChangeCount === 0}>
            Zatwierdz proponowane
          </button>
        </div>

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

      <section className="panel price-advisor-list">
        {rows.map(({ product, entry, stockQty, marketPrice, priceTarget, suggestedPrice, difference, status }) => (
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
              <a href={searchUrl(product, "google")} target="_blank" rel="noreferrer" className="btn-ghost">
                Google
              </a>
              <a href={searchUrl(product, "ceneo")} target="_blank" rel="noreferrer" className="btn-ghost">
                Ceneo
              </a>
              <a href={searchUrl(product, "allegro")} target="_blank" rel="noreferrer" className="btn-ghost">
                Allegro
              </a>
              <button
                className="btn-search"
                type="button"
                onClick={() => void verifyProduct(product)}
                disabled={Boolean(verifying[product.ean])}
              >
                {verifying[product.ean] ? "Sprawdzam..." : "Zweryfikuj"}
              </button>
            </div>

            <div className="price-row-inputs">
              <label>
                <span>Cena w internecie</span>
                <input
                  type="text"
                  inputMode="decimal"
                  value={entry.marketPrice}
                  onChange={(event) => updateEntry(product.ean, { marketPrice: event.target.value })}
                  placeholder="np. 24,90"
                />
              </label>

              <label>
                <span>Zrodlo</span>
                <input
                  type="text"
                  value={entry.source}
                  onChange={(event) => updateEntry(product.ean, { source: event.target.value })}
                  placeholder="sklep / link / notatka"
                />
              </label>
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
        ))}
      </section>
    </div>
  );
}
