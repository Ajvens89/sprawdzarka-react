import React from 'react';
import { useOrdersSync } from '../../hooks/useOrdersSync';
import { OrdersQueue } from './OrdersQueue';
import { useOrdersStore } from '../../store/useOrdersStore';
import { isActiveOrder } from './orders.utils';

export function OrdersDisplayPage() {
  useOrdersSync();
  const orders = useOrdersStore((s) => s.orders);
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

      <OrdersQueue />
    </div>
  );
}
