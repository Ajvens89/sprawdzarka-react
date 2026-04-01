import { Order, OrderStatus } from './orders.types';

export function formatOrderNumber(n: number): string {
  return String(n).padStart(3, '0');
}

export function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString('pl-PL', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatPrice(amount: number): string {
  return `${amount.toFixed(2)} zł`;
}

export const STATUS_LABELS: Record<OrderStatus, string> = {
  new:      'Nowe',
  preparing:'W trakcie',
  ready:    'Gotowe',
  done:     'Wydane',
};

export const STATUS_COLORS: Record<OrderStatus, string> = {
  new:      '#f59e0b',
  preparing:'#3b82f6',
  ready:    '#22c55e',
  done:     '#6b7280',
};

export function isActiveOrder(order: Order): boolean {
  return order.status !== 'done';
}

/** Wyznacz kolejny status */
export function nextStatus(current: OrderStatus): OrderStatus | null {
  const flow: OrderStatus[] = ['new', 'preparing', 'ready', 'done'];
  const idx = flow.indexOf(current);
  return idx < flow.length - 1 ? flow[idx + 1] : null;
}
