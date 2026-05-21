import React from 'react';
import { Order, OrderStatus } from './orders.types';
import {
  STATUS_LABELS,
  STATUS_COLORS,
  formatTime,
  formatPrice,
  nextStatus,
} from './orders.utils';
import { useOrdersStore } from '../../store/useOrdersStore';

interface Props {
  order: Order;
}

const NEXT_BUTTON_LABEL: Record<OrderStatus, string> = {
  new:      'Zacznij przygotowanie',
  preparing:'Oznacz jako gotowe',
  ready:    'Wydaj zamówienie',
  done:     '',
};

export function OrdersCard({ order }: Props) {
  const updateStatus = useOrdersStore((s) => s.updateOrderStatus);
  const next = nextStatus(order.status);

  const handleNext = async () => {
    if (next) await updateStatus(order.id, next);
  };

  const statusColor = STATUS_COLORS[order.status];

  return (
    <div
      className="order-card"
      style={{ '--status-color': statusColor } as React.CSSProperties}
    >
      {/* Nagłówek */}
      <div className="order-card-header">
        <div className="order-number">#{order.number}</div>
        <div className="order-time">{formatTime(order.createdAt)}</div>
        <div
          className="order-status-badge"
          style={{ background: statusColor }}
        >
          {STATUS_LABELS[order.status]}
        </div>
      </div>

      {/* Pozycje */}
      <ul className="order-items-list">
        {order.items.map((item) => (
          <li key={item.id} className="order-item-row">
            <span className="order-item-qty">{item.qty}×</span>
            <span className="order-item-name">{item.name}</span>
            <span className="order-item-price">
              {formatPrice(item.qty * item.unitPrice)}
            </span>
          </li>
        ))}
      </ul>

      {/* Notatka */}
      {order.note && (
        <div className="order-note">
          <span className="order-note-label">📝</span>
          <span>{order.note}</span>
        </div>
      )}

      {/* Suma + akcja */}
      <div className="order-card-footer">
        <div className="order-total">{formatPrice(order.total)}</div>
        {next && (
          <button
            className={`order-action-btn status-${next}`}
            onClick={handleNext}
          >
            {NEXT_BUTTON_LABEL[order.status]}
          </button>
        )}
      </div>
    </div>
  );
}
