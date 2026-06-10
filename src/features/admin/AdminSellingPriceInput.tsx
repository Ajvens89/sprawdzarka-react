import { useEffect, useState } from "react";

function parseSellingPriceInput(value: string): number | null {
  const normalized = value.replace(",", ".").replace(/[^\d.]/g, "");
  if (!normalized) return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed * 100) / 100 : null;
}

function formatPriceValue(value: number): string {
  return value.toFixed(2).replace(".", ",");
}

export function AdminSellingPriceInput({
  ean,
  currentPrice,
  hasOverride,
  onSave,
  onClearOverride
}: {
  ean: string;
  currentPrice: number;
  hasOverride: boolean;
  onSave: (ean: string, price: number) => void;
  onClearOverride: (ean: string) => void;
}): JSX.Element {
  const [draft, setDraft] = useState(formatPriceValue(currentPrice));
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    if (!isEditing) {
      setDraft(formatPriceValue(currentPrice));
    }
  }, [currentPrice, isEditing]);

  function commitDraft(): void {
    const parsed = parseSellingPriceInput(draft);
    if (parsed !== null) {
      onSave(ean, parsed);
      setDraft(formatPriceValue(parsed));
    } else {
      setDraft(formatPriceValue(currentPrice));
    }
    setIsEditing(false);
  }

  return (
    <div className="admin-price-input-wrap">
      <input
        className="admin-cost-input"
        type="text"
        inputMode="decimal"
        value={draft}
        title="Nasza cena sprzedaży brutto"
        onFocus={() => setIsEditing(true)}
        onBlur={commitDraft}
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.currentTarget.blur();
          }
        }}
      />
      {hasOverride ? (
        <button className="btn-mini" type="button" onClick={() => onClearOverride(ean)}>
          Bazowa
        </button>
      ) : null}
    </div>
  );
}
