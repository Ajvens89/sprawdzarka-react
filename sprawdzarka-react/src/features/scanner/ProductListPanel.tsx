import { LEGACY_PRODUCTS, filterProducts, getInventorySummary, getResolvedStock, getStockState } from "../../lib/scanner";
import { formatPrice, normalizeText } from "../../lib/utils";
import { useAppStore } from "../../store/useAppStore";

export function ProductListPanel({
  onSelectProduct
}: {
  onSelectProduct: (ean: string) => void;
}): JSX.Element {
  const filter = useAppStore((state) => state.filter);
  const onlyInStock = useAppStore((state) => state.onlyInStock);
  const stockOverrides = useAppStore((state) => state.stockOverrides);
  const inventoryCounts = useAppStore((state) => state.inventoryCounts);
  const inventoryVerified = useAppStore((state) => state.inventoryVerified);
  const productListView = useAppStore((state) => state.productListView);
  const setFilter = useAppStore((state) => state.setFilter);
  const toggleOnlyInStock = useAppStore((state) => state.toggleOnlyInStock);
  const setProductListView = useAppStore((state) => state.setProductListView);

  const stock = getResolvedStock(stockOverrides);
  const filteredProducts = filterProducts(LEGACY_PRODUCTS, filter, onlyInStock, stock);
  const summary = getInventorySummary(LEGACY_PRODUCTS, stock, inventoryCounts, inventoryVerified);

  return (
    <section className="panel panel-products">
      <div className="filter-shell">
        <span className="panel-label">
          Produkty
          <span
            className="count-badge"
            style={{
              fontSize: "inherit",
              letterSpacing: "normal",
              textTransform: "none",
              fontWeight: 400,
              margin: 0,
              color: "var(--muted)"
            }}
          >
            {filteredProducts.length} z {LEGACY_PRODUCTS.length} produktów · sprawdzone: {summary.verifiedCount} · różnice: {summary.differenceCount}
            {onlyInStock ? " · tylko stan > 0" : ""}
          </span>
        </span>

        <div className="filter-bar">
          <label className="sr-only" htmlFor="filterInput">Szukaj po nazwie lub EAN</label>
          <div className="search-input-wrap">
            <span className="search-icon" aria-hidden="true">&#9906;</span>
            <input
              id="filterInput"
              value={filter}
              onChange={(event) => setFilter(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Escape") setFilter("");
              }}
              placeholder="Szukaj po nazwie lub EAN…"
            />
          </div>

          <button className="btn-ghost" type="button" onClick={() => setFilter("")}>
            Wyczyść
          </button>

          <button
            className={`btn-toggle${onlyInStock ? " active" : ""}`}
            type="button"
            onClick={toggleOnlyInStock}
            aria-pressed={onlyInStock}
          >
            Tylko ze stanem
          </button>

          <button
            className={`btn-toggle${productListView === "full" ? " active" : ""}`}
            type="button"
            onClick={() => setProductListView("full")}
          >
            Pełny widok
          </button>

          <button
            className={`btn-toggle${productListView === "compact" ? " active" : ""}`}
            type="button"
            onClick={() => setProductListView("compact")}
          >
            Kompakt
          </button>
        </div>

        <div className={`product-list${productListView === "compact" ? " is-compact" : ""}`}>
          {filteredProducts.length === 0 ? (
            <div className="empty-state">Brak produktów pasujących do aktualnego filtra.</div>
          ) : (
            filteredProducts.map((product) => {
              const stockState = getStockState(product.ean, stock);
              const verified = Boolean(inventoryVerified[product.ean]);
              const qty = inventoryCounts[product.ean] ?? 0;
              const outOfStockClass = stockState.className === "out-stock" ? " out-of-stock" : "";
              const difference = verified && stockState.className !== "unknown-stock" ? qty - (stock[product.ean] ?? 0) : null;
              const differenceClass = difference && difference !== 0 ? " has-difference" : "";
              const verificationClass = verified ? " verified-product" : "";

              return (
                <button
                  key={product.ean}
                  type="button"
                  className={`product-item${outOfStockClass}${verificationClass}${differenceClass}`}
                  data-ean={product.ean}
                  onClick={() => onSelectProduct(product.ean)}
                  aria-label={`Wybierz produkt ${product.tytuł}, EAN ${product.ean}`}
                >
                  <div className="product-item-main">
                    <div className="product-item-name">{product.tytuł}</div>
                  </div>

                  <div className="product-item-meta">
                    <div className="product-item-price">{formatPrice(product.cena)} zł</div>
                    <div className="product-item-ean">{product.ean}</div>
                    <div className={`stock-mini ${stockState.className}`}>{stockState.shortLabel}</div>
                    <div className={`verification-mini ${verified ? (difference && difference !== 0 ? "difference" : "verified") : "pending"}`}>
                      {!verified
                        ? "⏳ nie sprawdzono"
                        : difference && difference !== 0
                          ? `△ różnica ${difference > 0 ? "+" : ""}${difference}`
                          : "✓ zgodne"}
                    </div>
                  </div>
                </button>
              );
            })
          )}
        </div>

        <p className="hint" style={{ marginTop: ".75rem" }}>
          Filtrowanie działa po nazwie i EAN. Dane źródłowe oraz stany bazowe pochodzą z legacy HTML.
        </p>
      </div>
    </section>
  );
}
