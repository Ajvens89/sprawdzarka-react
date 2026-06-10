import React from "react";
import { useOrdersSync } from "../../hooks/useOrdersSync";
import { PageHeader } from "../../components/ui/PageHeader";
import { OrdersQueue } from "./OrdersQueue";
import { useOrdersStore } from "../../store/useOrdersStore";
import { isActiveOrder } from "./orders.utils";

export function OrdersDisplayPage() {
  useOrdersSync();
  const orders = useOrdersStore((s) => s.orders);
  const lastSyncError = useOrdersStore((s) => s.lastSyncError);
  const clearSyncError = useOrdersStore((s) => s.clearSyncError);
  const activeCount = orders.filter(isActiveOrder).length;

  return (
    <div className="module-page display-page">
      <PageHeader
        label="Sprzedaż"
        title="Wydawanie"
        description={
          activeCount > 0
            ? `${activeCount} aktywn${activeCount === 1 ? "e" : "ych"} zamówien${activeCount === 1 ? "ie" : "ia"} w kolejce.`
            : "Kolejka pusta — oczekiwanie na zamówienia z kasy."
        }
      />

      {lastSyncError ? (
        <div className="orders-sync-error" role="alert">
          <div className="orders-sync-error-copy">
            <strong>Błąd synchronizacji z Bistro</strong>
            <p>{lastSyncError}</p>
          </div>
          <button className="orders-sync-error-dismiss" type="button" onClick={clearSyncError}>
            Zamknij
          </button>
        </div>
      ) : null}

      <OrdersQueue />
    </div>
  );
}
