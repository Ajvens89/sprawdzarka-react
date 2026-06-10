import React from 'react';
import { useOrdersSync } from '../../hooks/useOrdersSync';
import { OrdersQueue } from './OrdersQueue';
import { useOrdersStore } from '../../store/useOrdersStore';
import { isActiveOrder } from './orders.utils';

export function OrdersDisplayPage() {
  useOrdersSync();
  const orders = useOrdersStore((s) => s.orders);
  const lastSyncError = useOrdersStore((s) => s.lastSyncError);
  const clearSyncError = useOrdersStore((s) => s.clearSyncError);
  const activeCount = orders.filter(isActiveOrder).length;

  return (
    <div className="display-page">
      <header className="display-page-header">
        <h1 className="display-page-title">
          <span className="orders-title-accent">⚡</span> Wydawanie
        </h1>
        <div className="display-badge">
          {activeCount > 0
            ? `${activeCount} aktywn${activeCount === 1 ? 'e' : 'ych'}`
            : 'Kolejka pusta'}
        </div>
      </header>

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
