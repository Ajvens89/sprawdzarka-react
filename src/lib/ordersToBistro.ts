import { Order } from "../features/orders/orders.types";
import { ORDER_TO_BISTRO_MAP } from "../data/orderProducts";
import { useAppStore } from "../store/useAppStore";

export interface BistroSyncResult {
  synced: boolean;
  updatedIds: string[];
  missingIds: string[];
  skipReason?: string;
}

export function syncOrderToBistro(order: Order): BistroSyncResult {
  if (order.syncedToBistro) {
    return {
      synced: false,
      updatedIds: [],
      missingIds: [],
      skipReason: `Zamówienie #${order.number} jest już zsynchronizowane z Bistro.`
    };
  }

  if (order.status !== "done") {
    return {
      synced: false,
      updatedIds: [],
      missingIds: [],
      skipReason: `Zamówienie #${order.number} nie ma statusu "done".`
    };
  }

  const { bistroProducts, updateBistroProduct } = useAppStore.getState();

  const deltaMap = new Map<string, number>();

  for (const item of order.items) {
    const bistroId = ORDER_TO_BISTRO_MAP.get(item.id);
    if (!bistroId) continue;

    const current = deltaMap.get(bistroId) ?? 0;
    deltaMap.set(bistroId, current + item.qty);
  }

  if (deltaMap.size === 0) {
    return {
      synced: true,
      updatedIds: [],
      missingIds: []
    };
  }

  const missingIds: string[] = [];

  for (const bistroId of deltaMap.keys()) {
    const exists = bistroProducts.some((product) => product.id === bistroId);
    if (!exists) {
      missingIds.push(bistroId);
    }
  }

  if (missingIds.length > 0) {
    return {
      synced: false,
      updatedIds: [],
      missingIds,
      skipReason:
        `Brakuje produktów Bistro dla ID: ${missingIds.join(", ")}. ` +
        `Nie naliczam nic, żeby nie zgubić części sprzedaży.`
    };
  }

  const updatedIds: string[] = [];

  for (const [bistroId, delta] of deltaMap) {
    const bistroProduct = bistroProducts.find((product) => product.id === bistroId);
    if (!bistroProduct) continue;

    const newSoldQty = bistroProduct.soldQty + delta;
    updateBistroProduct(bistroId, "soldQty", newSoldQty);
    updatedIds.push(bistroId);
  }

  return {
    synced: true,
    updatedIds,
    missingIds: []
  };
}