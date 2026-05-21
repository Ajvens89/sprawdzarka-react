import { useState } from "react";
import { xlsxDownload } from "../../lib/export";
import { formatMoney } from "../../lib/utils";
import { useAppStore } from "../../store/useAppStore";
import { bistroCalcProduct } from "../../lib/bistro";

export function BistroSidebar(): JSX.Element {
  const [newName, setNewName] = useState("");

  const products = useAppStore((state) => state.bistroProducts);
  const selectedId = useAppStore((state) => state.bistroSelectedId);
  const selectBistroProduct = useAppStore((state) => state.selectBistroProduct);
  const addBistroProduct = useAppStore((state) => state.addBistroProduct);
  const resetBistro = useAppStore((state) => state.resetBistro);

  function handleAdd(): void {
    if (!newName.trim()) return;
    addBistroProduct(newName.trim());
    setNewName("");
  }

  function handleExport(): void {
    const rows: Array<Array<string | number>> = [
      ["Produkt", "Jednostka", "Porcja", "Cena porcji", "Sprzedano", "Przychód", "Zysk"]
    ];

    products.forEach((product) => {
      const calc = bistroCalcProduct(product);
      rows.push([
        product.name,
        product.batchUnit,
        product.portionQty,
        product.portionPrice,
        product.soldQty,
        calc.revenue,
        calc.profit
      ]);
    });

    xlsxDownload(rows, "bistro.xlsx", "Bistro");
  }

  return (
    <section className="panel panel-bistro-list">
      <span className="panel-label">Produkty Bistro</span>

      <div id="bistroListItems">
        {products.length === 0 ? (
          <div className="empty-state" style={{ padding: "1rem" }}>Brak produktów.</div>
        ) : (
          products.map((product) => {
            const calc = bistroCalcProduct(product);
            const profitColor = calc.profit > 0 ? "var(--success)" : calc.profit < 0 ? "var(--error)" : "var(--muted)";

            return (
              <div
                key={product.id}
                className={`bistro-list-item${product.id === selectedId ? " active" : ""}`}
                onClick={() => selectBistroProduct(product.id)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    selectBistroProduct(product.id);
                  }
                }}
                tabIndex={0}
                role="button"
              >
                <span className="bistro-list-item-name">{product.name}</span>
                <span className="bistro-list-item-meta">
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: ".75rem", color: "var(--blue)" }}>
                    {formatMoney(calc.revenue)}
                  </span>
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: ".7rem", color: profitColor }}>
                    {formatMoney(calc.profit)}
                  </span>
                </span>
              </div>
            );
          })
        )}
      </div>

      <div className="bistro-add-row" style={{ marginTop: ".75rem" }}>
        <input
          type="text"
          value={newName}
          onChange={(event) => setNewName(event.target.value)}
          placeholder="Nazwa nowego produktu…"
          autoComplete="off"
          spellCheck={false}
          onKeyDown={(event) => {
            if (event.key === "Enter") handleAdd();
          }}
        />
        <button className="btn-search" type="button" onClick={handleAdd}>Dodaj</button>
      </div>

      <div className="bistro-toolbar" style={{ marginTop: ".75rem" }}>
        <button className="btn-ghost" type="button" onClick={handleExport}>Eksport XLSX</button>
        <button className="btn-ghost btn-ghost--danger" type="button" onClick={resetBistro}>Reset bistro</button>
      </div>

      <p className="hint" style={{ marginTop: ".6rem" }}>Stan jest zapisywany lokalnie, a po podłączeniu Firebase również synchronizowany.</p>
    </section>
  );
}
