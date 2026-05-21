export type OrderStatus = 'new' | 'preparing' | 'ready' | 'done';

export interface OrderItem {
  id: string;
  name: string;
  qty: number;
  unitPrice: number;
  category: string;
}

export interface Order {
  id: string;
  number: string;
  createdAt: number;
  createdBy: string;
  status: OrderStatus;
  note: string;
  items: OrderItem[];
  total: number;
  /** Czy soldQty w Bistro zostało już zaktualizowane dla tego zamówienia */
  syncedToBistro: boolean;
  /** Timestamp momentu synchronizacji z Bistro */
  syncedToBistroAt?: number;
}
