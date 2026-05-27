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
const ORDER_NUMBER_PATH = `${ORDERS_PATH}/_meta/nextNumber`;
const SYNC_LOCK_TTL_MS = 5 * 60 * 1000;

type OrderSyncLock = {
  workerId: string;
  claimedAt: number;
};

type OrderRecord = Order & {
  bistroSyncLock?: OrderSyncLock | null;
};

export function isOrdersFirebaseReady(): boolean {
  return Boolean(database);
}

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

function isOrderRecord(value: unknown): value is Order {
  return Boolean(value && typeof value === "object" && "id" in value && "createdAt" in value);
}

export function subscribeOrders(callback: (orders: Order[]) => void): () => void {
  if (!database) {
    callback([]);
    return () => undefined;
  }

  const r = ordersRef();

  onValue(r, (snap) => {
    const val = snap.val();
    if (!val || typeof val !== "object") {
      callback([]);
      return;
    }

    const orders = Object.entries(val as Record<string, unknown>)
      .filter(([key, value]) => key !== "_meta" && isOrderRecord(value))
      .map(([, value]) => value as Order);

    orders.sort((a, b) => a.createdAt - b.createdAt);
    callback(orders);
  });

  return () => off(r);
}

export async function allocateOrderNumber(): Promise<number> {
  const db = getDatabaseOrThrow();
  const counterRef = ref(db, ORDER_NUMBER_PATH);

  const result = await runTransaction(counterRef, (current) => {
    const next = typeof current === "number" && Number.isFinite(current) ? current + 1 : 1;
    return next;
  });

  if (!result.committed || typeof result.snapshot.val() !== "number") {
    throw new Error("Nie udało się nadać numeru zamówienia.");
  }

  return result.snapshot.val() as number;
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
        const lockAge = Date.now() - current.bistroSyncLock.claimedAt;
        if (lockAge < SYNC_LOCK_TTL_MS && current.bistroSyncLock.workerId !== workerId) {
          return;
        }
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
