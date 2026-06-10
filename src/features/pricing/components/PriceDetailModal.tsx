import { Modal } from "../../../components/ui/Modal";
import { StatusPill } from "../../../components/ui/StatusPill";
import { formatMoney } from "../../../lib/utils";
import type { PriceEntry, Product } from "../../../types/app";
import { priceStatusLabel, productTitle, searchUrl, type PriceRowStatus } from "../pricingUtils";

export type PriceDetailRow = {
  product: Product;
  entry: PriceEntry;
  stockQty: number;
  marketPrice: number | null;
  priceTarget: number | null;
  suggestedPrice: number;
  difference: number | null;
  status: PriceRowStatus;
};

function statusVariant(status: PriceRowStatus): "ok" | "warning" | "error" | "muted" {
  if (status === "missing") return "muted";
  if (status === "too-high") return "error";
  if (status === "low") return "ok";
  return "ok";
}

export function PriceDetailModal({
  row,
  verifying,
  onClose,
  onUpdateEntry,
  onVerify
}: {
  row: PriceDetailRow;
  verifying: boolean;
  onClose: () => void;
  onUpdateEntry: (patch: Partial<PriceEntry>) => void;
  onVerify: (options?: { force?: boolean }) => void;
}): JSX.Element {
  const { product, entry, stockQty, marketPrice, priceTarget, suggestedPrice, difference, status } = row;

  return (
    <Modal title={productTitle(product)} onClose={onClose}>
      <div className="price-detail-modal">
        <div className="price-detail-modal__meta">
          <span>EAN {product.ean}</span>
          <span>Stan: {stockQty} szt.</span>
          <span>Nasza cena: {formatMoney(product.cena)}</span>
          <StatusPill variant={statusVariant(status)}>{priceStatusLabel(status)}</StatusPill>
        </div>

        <div className="price-row-actions price-detail-modal__links">
          <a href={searchUrl(product, "google")} target="_blank" rel="noreferrer" className="btn-ghost">
            Google
          </a>
          <a href={searchUrl(product, "ceneo")} target="_blank" rel="noreferrer" className="btn-ghost">
            Ceneo
          </a>
          <a href={searchUrl(product, "allegro")} target="_blank" rel="noreferrer" className="btn-ghost">
            Allegro
          </a>
          <button className="btn-search" type="button" onClick={() => onVerify({ force: true })} disabled={verifying}>
            {verifying ? "Sprawdzam…" : "Zweryfikuj online"}
          </button>
        </div>

        <div className="price-row-inputs">
          <label>
            <span>Cena w internecie</span>
            <input
              type="text"
              inputMode="decimal"
              value={entry.marketPrice}
              onChange={(event) => onUpdateEntry({ marketPrice: event.target.value })}
              placeholder="np. 24,90"
            />
          </label>

          <label>
            <span>Źródło / notatka</span>
            <input
              type="text"
              value={entry.source}
              onChange={(event) => onUpdateEntry({ source: event.target.value })}
              placeholder="sklep / link / notatka"
            />
          </label>
        </div>

        <div className="price-row-result">
          {!marketPrice ? (
            <span className="price-status muted">Brak danych rynkowych — użyj „Zweryfikuj online” lub wpisz ręcznie.</span>
          ) : status === "too-high" ? (
            <>
              <span className="price-status danger">Obniż do {formatMoney(suggestedPrice)}</span>
              <span className="price-difference">Różnica: +{formatMoney(Math.max(0, difference ?? 0))}</span>
              {priceTarget ? <span className="price-check-note">Cel: {formatMoney(priceTarget)}</span> : null}
            </>
          ) : status === "low" ? (
            <span className="price-status success">Cena atrakcyjna względem rynku</span>
          ) : (
            <span className="price-status success">Cena w normie</span>
          )}
          {entry.status ? <span className="price-check-note">{entry.status}</span> : null}
          {entry.checkedAt ? <span className="price-check-note">Ostatnio: {entry.checkedAt}</span> : null}
        </div>
      </div>
    </Modal>
  );
}
