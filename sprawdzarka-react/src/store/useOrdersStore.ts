import { create } from "zustand";
import { v4 as uuid } from "uuid";
import { Order, OrderItem, OrderStatus } from "../features/orders/orders.types";
import { formatOrderNumber } from "../features/orders/orders.utils";
import {
  markOrderDone,
  releaseOrderDoneSyncClaim,
  saveOrder,
  tryClaimOrderDoneSync,
  updateOrderStatus as updateOrderStatusRemote
} from "../lib/orders.firebase";
import { syncOrderToBistro } from "../lib/ordersToBistro";

interface CartItem extends OrderItem {}

interface OrdersState {
  cartItems: CartItem[];
  cartNote: string;
  orders: Order[];
  nextOrderNumber: number;
  processingDoneIds: string[];

  addToCart: (product: {
    id: string;
    name: string;
    unitPrice: number;
    category: string;
  }) => void;
  incrementCartItem: (id: string) => void;
  decrementCartItem: (id: string) => void;
  removeCartItem: (id: string) => void;
  setCartNote: (note: string) => void;
  clearCart: () => void;

  submitOrder: (createdBy?: string) => Promise<void>;
  setOrders: (orders: Order[]) => void;
  updateOrderStatus: (id: string, status: OrderStatus) => Promise<void>;
}

const DEVICE_WORKER_ID =
  `orders-device-${Math.random().toString(36).slice(2)}-${Date.now().toString(36)}`;

function parseOrderNumber(value: string): number {
  const n = Number.parseInt(String(value).replace(/\D/g, ""), 10);
  return Number.isFinite(n) ? n : 0;
}

export const useOrdersStore = create<OrdersState>((set, get) => ({
  cartItems: [],
  cartNote: "",
  orders: [],
  nextOrderNumber: 1,
  processingDoneIds: [],

  addToCart(product) {
    set((state) => {
      const existing = state.cartItems.find((item) => item.id === product.id);

      if (existing) {
        return {
          cartItems: state.cartItems.map((item) =>
            item.id === product.id ? { ...item, qty: item.qty + 1 } : item
          )
        };
      }

      return {
        cartItems: [...state.cartItems, { ...product, qty: 1 }]
      };
    });
  },

  incrementCartItem(id) {
    set((state) => ({
      cartItems: state.cartItems.map((item) =>
        item.id === id ? { ...item, qty: item.qty + 1 } : item
      )
    }));
  },

  decrementCartItem(id) {
    set((state) => ({
      cartItems: state.cartItems
        .map((item) => (item.id === id ? { ...item, qty: item.qty - 1 } : item))
        .filter((item) => item.qty > 0)
    }));
  },

  removeCartItem(id) {
    set((state) => ({
      cartItems: state.cartItems.filter((item) => item.id !== id)
    }));
  },

  setCartNote(note) {
    set({ cartNote: note });
  },

  clearCart() {
    set({ cartItems: [], cartNote: "" });
  },

  async submitOrder(createdBy = "kasa") {
    const { cartItems, cartNote, nextOrderNumber, clearCart } = get();
    if (cartItems.length === 0) return;

    const total = cartItems.reduce((sum, item) => sum + item.qty * item.unitPrice, 0);

    const order: Order = {
      id: uuid(),
      number: formatOrderNumber(nextOrderNumber),
      createdAt: Date.now(),
      createdBy,
      status: "new",
      note: cartNote.trim(),
      items: cartItems,
      total,
      syncedToBistro: false
    };

    set((state) => ({
      nextOrderNumber: state.nextOrderNumber + 1
    }));

    clearCart();
    await saveOrder(order);
  },

  setOrders(orders) {
    const maxNumber = orders.reduce((max, order) => {
      return Math.max(max, parseOrderNumber(order.number));
    }, 0);

    set({
      orders,
      nextOrderNumber: Math.max(1, maxNumber + 1)
    });
  },

  async updateOrderStatus(id, status) {
    if (status !== "done") {
      await updateOrderStatusRemote(id, status);
      return;
    }

    const state = get();

    if (state.processingDoneIds.includes(id)) {
      return;
    }

    const order = state.orders.find((item) => item.id === id);

    if (!order) {
      console.error(`[useOrdersStore] Nie znaleziono zamówienia ${id}.`);
      return;
    }

    if (order.syncedToBistro) {
      await updateOrderStatusRemote(id, "done");
      return;
    }

    set((current) => ({
      processingDoneIds: [...current.processingDoneIds, id]
    }));

    try {
      const claim = await tryClaimOrderDoneSync(id, DEVICE_WORKER_ID);

      if (!claim.ok) {
        console.warn(`[orders] Pomijam #${order.number}: ${claim.reason ?? "brak claimu"}`);
        return;
      }

      const syncResult = syncOrderToBistro({
        ...order,
        status: "done"
      });

      if (!syncResult.synced) {
        await releaseOrderDoneSyncClaim(id);
        console.warn(
          `[orders] Nie zsynchronizowano #${order.number}: ${syncResult.skipReason ?? "nieznany błąd"}`
        );
        return;
      }

      await markOrderDone(id);

      set((current) => ({
        orders: current.orders.map((item) =>
          item.id === id
            ? {
                ...item,
                status: "done",
                syncedToBistro: true,
                syncedToBistroAt: Date.now()
              }
            : item
        )
      }));
    } catch (error) {
      console.error(`[orders] Błąd podczas finalizacji zamówienia ${id}`, error);

      try {
        await releaseOrderDoneSyncClaim(id);
      } catch (releaseError) {
        console.error("[orders] Nie udało się zwolnić blokady sync.", releaseError);
      }
    } finally {
      set((current) => ({
        processingDoneIds: current.processingDoneIds.filter((itemId) => itemId !== id)
      }));
    }
  }
}));