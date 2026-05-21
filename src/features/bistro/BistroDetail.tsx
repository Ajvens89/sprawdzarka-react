import React, { useState } from "react";
import { BISTRO_UNITS } from "../../data/bistroDefaults";
import { bistroCalcProduct } from "../../lib/bistro";
import { formatMoney, safeNumber, todayStr } from "../../lib/utils";
import { useAppStore } from "../../store/useAppStore";

export function BistroDetail(): JSX.Element {
  const products = useAppStore((state) => state.bistroProducts);
  const selectedId = useAppStore((state) => state.bistroSelectedId);
  const updateBistroProduct = useAppStore((state) => state.updateBistroProduct);
  const deleteBistroProduct = useAppStore((state) => state.deleteBistroProduct);
  const addPurchase = useAppStore((state) => state.addPurchase);
  const removePurchase = useAppStore((state) => state.removePurchase);

  const selected = products.find((product) => product.id === selectedId) ?? null;

  if (!selected) {
    return (
      <section className="panel panel-bistro-detail" id="bistroDetailPanel">
        <div
          id="bistroDetailEmpty"
          style={{
            padding: "3rem 1rem",
            textAlign: "center",
            color: "var(--muted)",
            fontSize: ".85rem"
          }}
        >
          Wybierz produkt z listy po lewej, aby edytować szczegóły.
        </div>
      </section>
    );
  }

  const selectedProduct = selected;
  const selectedProductId = selectedProduct.id;
  const calc = bistroCalcProduct(selectedProduct);

  function numberField<K extends "portionQty" | "portionPrice" | "soldQty">(
    field: K,
    value: string
  ): void {
    updateBistroProduct(
      selectedProductId,
      field,
      safeNumber(value, field === "portionQty" ? 1 : 0) as never
    );
  }

  return (
    <section className="panel panel-bistro-detail" id="bistroDetailPanel">
      <div className="detail-header">
        <div>
          <div className="detail-kicker">Wybrany produkt</div>
          <h3 className="detail-title">{selectedProduct.name}</h3>
        </div>
      </div>

      <div className="bp-card" data-id={selectedProductId}>
        <div className="bp-header">
          <input
            className="bp-name"
            value={selectedProduct.name}
            onChange={(event) =>
              updateBistroProduct(selectedProductId, "name", event.target.value)
            }
          />
          <button
            className="bp-delete"
            type="button"
            onClick={() => deleteBistroProduct(selectedProductId)}
          >
            Usuń
          </button>
        </div>

        <div className="bp-body">
          <div className="bp-section">
            <div className="bp-section-label">Ustawienia sprzedaży</div>
            <div className="bp-fields">
              <div className="bp-field">
                <span className="bp-field-label">Jednostka wsadu</span>
                <select
                  className="bp-unit-select"
                  value={selectedProduct.batchUnit}
                  onChange={(event) =>
                    updateBistroProduct(
                      selectedProductId,
                      "batchUnit",
                      event.target.value as never
                    )
                  }
                >
                  {BISTRO_UNITS.map((unit) => (
                    <option key={unit} value={unit}>
                      {unit}
                    </option>
                  ))}
                </select>
              </div>

              <div className="bp-field">
                <span className="bp-field-label">Wielkość porcji</span>
                <input
                  className="bp-input"
                  type="number"
                  min="0.001"
                  step="0.001"
                  value={selectedProduct.portionQty}
                  onChange={(event) => numberField("portionQty", event.target.value)}
                />
              </div>

              <div className="bp-field">
                <span className="bp-field-label">Cena porcji</span>
                <input
                  className="bp-input"
                  type="number"
                  min="0"
                  step="0.01"
                  value={selectedProduct.portionPrice}
                  onChange={(event) => numberField("portionPrice", event.target.value)}
                />
              </div>

              <div className="bp-field">
                <span className="bp-field-label">Sprzedane porcje</span>
                <input
                  className="bp-input"
                  type="number"
                  min="0"
                  step="1"
                  value={selectedProduct.soldQty}
                  onChange={(event) => numberField("soldQty", event.target.value)}
                />
              </div>
            </div>
          </div>

          <div className="bp-section">
            <div className="bp-section-label">Wynik</div>
            <div className="bp-fields">
              <div className="bp-field">
                <span className="bp-field-label">Zakupy razem</span>
                <input
                  className="bp-input"
                  value={`${calc.batchQty} ${selectedProduct.batchUnit}`}
                  readOnly
                />
              </div>
              <div className="bp-field">
                <span className="bp-field-label">Koszt wsadu</span>
                <input className="bp-input" value={formatMoney(calc.batchCost)} readOnly />
              </div>
              <div className="bp-field">
                <span className="bp-field-label">Koszt porcji</span>
                <input
                  className="bp-input"
                  value={
                    calc.costPerPortion === null ? "—" : formatMoney(calc.costPerPortion)
                  }
                  readOnly
                />
              </div>
              <div className="bp-field">
                <span className="bp-field-label">Pozostało teoretycznie</span>
                <input
                  className="bp-input"
                  value={`${calc.theoreticalLeft} ${selectedProduct.batchUnit}`}
                  readOnly
                />
              </div>
            </div>
          </div>
        </div>

        <div className="bp-results">
          <div className="bp-result-item">
            <div className="bp-result-label">Przychód</div>
            <div className="bp-result-value revenue">{formatMoney(calc.revenue)}</div>
          </div>
          <div className="bp-result-item">
            <div className="bp-result-label">Koszt</div>
            <div className="bp-result-value cost">
              {calc.costPerPortion === null
                ? "—"
                : formatMoney((calc.costPerPortion ?? 0) * selectedProduct.soldQty)}
            </div>
          </div>
          <div className="bp-result-item">
            <div className="bp-result-label">Zysk</div>
            <div
              className={`bp-result-value profit ${
                calc.profit > 0 ? "pos" : calc.profit < 0 ? "neg" : "zero"
              }`}
            >
              {formatMoney(calc.profit)}
            </div>
          </div>
          <div className="bp-result-item">
            <div className="bp-result-label">Marża</div>
            <div className="bp-result-value warn">
              {calc.margin === null ? "—" : `${calc.margin.toFixed(1).replace(".", ",")} %`}
            </div>
          </div>
          <div className="bp-result-item">
            <div className="bp-result-label">Pozostało</div>
            <div className="bp-result-value muted">
              {calc.theoreticalLeft} {selectedProduct.batchUnit}
            </div>
          </div>
        </div>

        <div className="bp-purchases">
          <div className="bp-purchases-header">
            <div className="bp-purchases-title">Zakupy</div>
            <div className="bp-purchases-total">{formatMoney(calc.batchCost)}</div>
          </div>

          <div className="bp-purchase-log">
            {selectedProduct.purchases.length === 0 ? (
              <div className="empty-state" style={{ padding: "1rem" }}>
                Brak zapisanych zakupów.
              </div>
            ) : (
              selectedProduct.purchases.map((purchase) => (
                <div key={purchase.id} className="bp-purchase-entry">
                  <span className="bp-purchase-date">{purchase.date}</span>
                  <span className="bp-purchase-qty">
                    {purchase.qty} {selectedProduct.batchUnit}
                  </span>
                  <span className="bp-purchase-cost">{formatMoney(purchase.cost)}</span>
                  <span className="bp-purchase-note">{purchase.note || "—"}</span>
                  <button
                    className="bp-purchase-del"
                    type="button"
                    onClick={() => removePurchase(selectedProductId, purchase.id)}
                  >
                    ✕
                  </button>
                </div>
              ))
            )}
          </div>

          <PurchaseForm
            unit={selectedProduct.batchUnit}
            onSubmit={(purchase) => addPurchase(selectedProductId, purchase)}
          />
        </div>
      </div>
    </section>
  );
}

function PurchaseForm({
  unit,
  onSubmit
}: {
  unit: string;
  onSubmit: (purchase: { date: string; qty: number; cost: number; note: string }) => void;
}): JSX.Element {
  const [date, setDate] = useState(todayStr());
  const [qty, setQty] = useState("0");
  const [cost, setCost] = useState("0");
  const [note, setNote] = useState("");

  function handleSubmit(): void {
    onSubmit({
      date,
      qty: safeNumber(qty, 0),
      cost: safeNumber(cost, 0),
      note
    });

    setQty("0");
    setCost("0");
    setNote("");
  }

  return (
    <div className="bp-add-purchase">
      <input
        className="bp-ap-input"
        type="date"
        value={date}
        onChange={(event) => setDate(event.target.value)}
      />
      <input
        className="bp-ap-input"
        type="number"
        min="0"
        step="0.001"
        value={qty}
        onChange={(event) => setQty(event.target.value)}
        placeholder={`Ilość (${unit})`}
      />
      <input
        className="bp-ap-input"
        type="number"
        min="0"
        step="0.01"
        value={cost}
        onChange={(event) => setCost(event.target.value)}
        placeholder="Koszt"
      />
      <input
        className="bp-ap-input"
        type="text"
        value={note}
        onChange={(event) => setNote(event.target.value)}
        placeholder="Notatka"
      />
      <button className="bp-ap-confirm" type="button" onClick={handleSubmit}>
        Dodaj zakup
      </button>
    </div>
  );
}