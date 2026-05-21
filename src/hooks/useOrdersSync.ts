import { useEffect } from 'react';
import { subscribeOrders } from '../lib/orders.firebase';
import { useOrdersStore } from '../store/useOrdersStore';

/**
 * Montuj w komponencie najwyższego poziomu danego widoku (OrdersPage / OrdersDisplayPage).
 * Subskrybuje orders_live w Firebase i aktualizuje store.
 */
export function useOrdersSync() {
  const setOrders = useOrdersStore((s) => s.setOrders);

  useEffect(() => {
    const unsubscribe = subscribeOrders((orders) => {
      setOrders(orders);
    });
    return unsubscribe;
  }, [setOrders]);
}
