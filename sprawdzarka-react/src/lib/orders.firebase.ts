import {
  DatabaseReference,
  off,
  onValue,
  ref,
  runTransaction,
  set,
  update
} from "firebase/database";
import { database } from "./firebase";
import { Order, OrderStatus } from "../features/orders/orders.types";

const ORDERS_PATH = "orders_live";

type OrderSyncLock = {
  workerId: string;
  claimedAt: number;
};

type OrderRecord = Order & {
  bistroSyncLock?: OrderSyncLock | null;
};

function getDatabaseOrThrow() {
  if (!database) {
    throw new Error("Firebase Database nie jest skonfigurowana.");
  }

  return database;
}

export function ordersRef(): DatabaseReference {
  const db = getDatabaseOrThrow();
  return ref(db, ORDERS_PATH);
}

export function orderRef(id: string): DatabaseReference {
  const db = getDatabaseOrThrow();
  return ref(db, `${ORDERS_PATH}/${id}`);
}

export function subscribeOrders(callback: (orders: Order[]) => void): () => void {
  const r = ordersRef();

  onValue(r, (snap) => {
    const val = snap.val();
    if (!val) {
      callback([]);
      return;
    }

    const orders = Object.values(val) as Order[];
    orders.sort((a, b) => a.createdAt - b.createdAt);
    callback(orders);
  });

  return () => off(r);
}

export async function saveOrder(order: Order): Promise<void> {
  await set(orderRef(order.id), {
    ...order,
    syncedToBistro: false,
    syncedToBistroAt: null,
    bistroSyncLock: null
  });
}

export async function updateOrderStatus(id: string, status: OrderStatus): Promise<void> {
  await update(orderRef(id), { status });
}

export async function tryClaimOrderDoneSync(
  id: string,
  workerId: string
): Promise<{ ok: boolean; reason?: string }> {
  const result = await runTransaction(
    orderRef(id),
    (current: OrderRecord | null) => {
      if (!current) return current;

      if (current.syncedToBistro === true) {
        return;
      }

      if (current.bistroSyncLock) {
        return;
      }

      return {
        ...current,
        bistroSyncLock: {
          workerId,
          claimedAt: Date.now()
        }
      };
    },
    {
      applyLocally: false
    }
  );

  if (!result.committed) {
    return {
      ok: false,
      reason: "Zamówienie jest już zsynchronizowane albo zablokowane przez inne urządzenie."
    };
  }

  return { ok: true };
}

export async function releaseOrderDoneSyncClaim(id: string): Promise<void> {
  await update(orderRef(id), {
    bistroSyncLock: null
  });
}

export async function markOrderDone(id: string): Promise<void> {
  await update(orderRef(id), {
    status: "done" as OrderStatus,
    syncedToBistro: true,
    syncedToBistroAt: Date.now(),
    bistroSyncLock: null
  });
}