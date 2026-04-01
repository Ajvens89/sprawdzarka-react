import React from 'react';
import { useOrdersStore } from '../../store/useOrdersStore';
import { isActiveOrder } from './orders.utils';
import { OrdersCard } from './OrdersCard';

export function OrdersQueue() {
  const orders = useOrdersStore((s) => s.orders);
  const active = orders.filter(isActiveOrder);

  if (active.length === 0) {
    return (
      <div className="queue-empty">
        <div className="queue-empty-icon">✓</div>
        <p>Brak aktywnych zamówień</p>
      </div>
    );
  }

  return (
    <div className="orders-queue">
      {active.map((order) => (
        <OrdersCard key={order.id} order={order} />
      ))}
    </div>
  );
}
