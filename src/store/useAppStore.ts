import { create } from "zustand";
import { persist } from "zustand/middleware";
import { BISTRO_DEFAULTS } from "../data/bistroDefaults";
import type {
  AppSnapshot,
  BistroProduct,
  InventoryCountsMap,
  InventoryVerifiedMap,
  PriceEntriesMap,
  PriceEntry,
  PriceMap,
  RemoteSnapshot,
  SaveStatus,
  StockMap
} from "../types/app";
import { clampFloor, localDateTimeLabel, safeNumber, todayStr, uid } from "../lib/utils";

type SyncMeta = {
  saveStatus: SaveStatus;
  saveLabel: string;
  connectionLabel: string;
  unsavedChanges: number;
};

type AppState = SyncMeta & {
  filter: string;
  onlyInStock: boolean;
  inventoryOnlyDifferences: boolean;
  productListView: "compact" | "full";
  stockOverrides: StockMap;
  priceOverrides: PriceMap;
  priceEntries: PriceEntriesMap;
  inventoryCounts: InventoryCountsMap;
  inventoryVerified: InventoryVerifiedMap;
  bistroProducts: BistroProduct[];
  bistroSelectedId: string | null;

  setFilter: (value: string) => void;
  toggleOnlyInStock: () => void;
  toggleInventoryOnlyDifferences: () => void;
  setProductListView: (mode: "compact" | "full") => void;

  registerInventoryScan: (ean: string) => void;
  updateInventoryCount: (ean: string, delta: number) => void;
  verifyInventoryZero: (ean: string) => void;
  clearInventoryVerification: (ean: string) => void;
  resetInventory: () => void;

  setStockOverride: (ean: string, qty: number) => void;
  replaceStockOverrides: (overrides: StockMap) => void;
  approvePriceOverrides: (overrides: PriceMap) => void;
  setPriceEntry: (ean: string, entry: PriceEntry) => void;
  replacePriceEntries: (entries: PriceEntriesMap) => void;

  selectBistroProduct: (id: string | null) => void;
  addBistroProduct: (name: string) => void;
  updateBistroProduct: <K extends keyof BistroProduct>(id: string, field: K, value: BistroProduct[K]) => void;
  deleteBistroProduct: (id: string) => void;
  resetBistro: () => void;
  addPurchase: (productId: string, purchase: { date: string; qty: number; cost: number; note: string }) => void;
  removePurchase: (productId: string, purchaseId: string) => void;

  markDirty: () => void;
  setSyncStatus: (status: SaveStatus, connectionLabel?: string) => void;
  hydrateRemoteSnapshot: (snapshot: RemoteSnapshot) => void;
  importSnapshot: (snapshot: AppSnapshot) => void;
  exportSnapshot: () => AppSnapshot;
};

function statusLabel(status: SaveStatus, unsavedChanges: number): string {
  const timestamp = localDateTimeLabel();
  if (status === "dirty") return `${unsavedChanges} niezapisanych zmian`;
  if (status === "saving") return "synchronizuję…";
  if (status === "offline") return "offline — zmiany w kolejce";
  if (status === "synced") return `sync ${timestamp}`;
  if (status === "saved") return `zapisano ${timestamp}`;
  return "—";
}

function sanitizeInventoryCounts(value: unknown): InventoryCountsMap {
  if (!value || typeof value !== "object") return {};

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .map(([ean, qty]) => [ean.replace(/\D/g, "").slice(0, 13), clampFloor(Number(qty))] as const)
      .filter(([ean]) => /^\d{13}$/.test(ean))
  );
}

function sanitizePriceOverrides(value: unknown): PriceMap {
  if (!value || typeof value !== "object") return {};

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .map(([ean, price]) => [ean.replace(/\D/g, "").slice(0, 13), Math.round(safeNumber(price, 0) * 100) / 100] as const)
      .filter(([ean, price]) => /^\d{13}$/.test(ean) && price > 0)
  );
}

function sanitizePriceEntries(value: unknown): PriceEntriesMap {
  if (!value || typeof value !== "object") return {};

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .map(([ean, entry]) => {
        const normalizedEan = ean.replace(/\D/g, "").slice(0, 13);
        const item = entry as Partial<PriceEntry> | null;

        return [
          normalizedEan,
          {
            marketPrice: String(item?.marketPrice ?? ""),
            source: String(item?.source ?? ""),
            checkedAt: item?.checkedAt ? String(item.checkedAt) : undefined,
            status: item?.status ? String(item.status) : undefined
          }
        ] as const;
      })
      .filter(([ean, entry]) => {
        return /^\d{13}$/.test(ean) && Boolean(entry.marketPrice || entry.source || entry.checkedAt || entry.status);
      })
  );
}

function sanitizeInventoryVerified(value: unknown, counts: InventoryCountsMap): InventoryVerifiedMap {
  const verified = new Set<string>();

  if (value && typeof value === "object") {
    Object.entries(value as Record<string, unknown>)
      .filter(([, flag]) => Boolean(flag))
      .forEach(([ean]) => {
        const normalized = ean.replace(/\D/g, "").slice(0, 13);
        if (/^\d{13}$/.test(normalized)) verified.add(normalized);
      });
  }

  Object.entries(counts).forEach(([ean, qty]) => {
    if ((qty ?? 0) > 0) verified.add(ean);
  });

  return Object.fromEntries([...verified].map((ean) => [ean, true]));
}

function sanitizeBistroProducts(value: unknown): BistroProduct[] {
  if (!Array.isArray(value) || value.length === 0) {
    return BISTRO_DEFAULTS.map((product) => ({ ...product, purchases: [...product.purchases] }));
  }

  return value.map((item, index) => ({
    id: String((item as BistroProduct).id ?? `b${index + 1}`),
    name: String((item as BistroProduct).name ?? "Produkt"),
    batchUnit: (["g", "kg", "ml", "l", "szt"].includes(String((item as BistroProduct).batchUnit))
      ? (item as BistroProduct).batchUnit
      : "szt") as BistroProduct["batchUnit"],
    portionQty: Math.max(0.001, safeNumber((item as BistroProduct).portionQty, 1)),
    portionPrice: Math.max(0, safeNumber((item as BistroProduct).portionPrice, 0)),
    soldQty: Math.max(0, clampFloor(safeNumber((item as BistroProduct).soldQty, 0))),
    purchases: Array.isArray((item as BistroProduct).purchases)
      ? (item as BistroProduct).purchases.map((purchase) => ({
          id: String(purchase.id ?? uid("purchase")),
          date: String(purchase.date ?? todayStr()),
          qty: Math.max(0, safeNumber(purchase.qty, 0)),
          cost: Math.max(0, safeNumber(purchase.cost, 0)),
          note: String(purchase.note ?? "")
        }))
      : []
  }));
}

const initialSyncMeta: SyncMeta = {
  saveStatus: "idle",
  saveLabel: "—",
  connectionLabel: "",
  unsavedChanges: 0
};

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      ...initialSyncMeta,
      filter: "",
      onlyInStock: false,
      inventoryOnlyDifferences: false,
      productListView: "compact",
      stockOverrides: {},
      priceOverrides: {},
      priceEntries: {},
      inventoryCounts: {},
      inventoryVerified: {},
      bistroProducts: BISTRO_DEFAULTS.map((product) => ({ ...product, purchases: [...product.purchases] })),
      bistroSelectedId: BISTRO_DEFAULTS[0]?.id ?? null,

      setFilter: (value) => set({ filter: value }),
      toggleOnlyInStock: () => set((state) => ({ onlyInStock: !state.onlyInStock })),
      toggleInventoryOnlyDifferences: () => set((state) => ({ inventoryOnlyDifferences: !state.inventoryOnlyDifferences })),
      setProductListView: (mode) => set({ productListView: mode }),

      registerInventoryScan: (ean) => {
        set((state) => {
          const nextQty = clampFloor((state.inventoryCounts[ean] ?? 0) + 1);
          return {
            inventoryCounts: { ...state.inventoryCounts, [ean]: nextQty },
            inventoryVerified: { ...state.inventoryVerified, [ean]: true }
          };
        });
        get().markDirty();
      },

      updateInventoryCount: (ean, delta) => {
        set((state) => {
          const current = state.inventoryCounts[ean] ?? 0;
          const next = Math.max(0, current + delta);
          return {
            inventoryCounts: { ...state.inventoryCounts, [ean]: next },
            inventoryVerified: { ...state.inventoryVerified, [ean]: true }
          };
        });
        get().markDirty();
      },

      verifyInventoryZero: (ean) => {
        set((state) => ({
          inventoryCounts: { ...state.inventoryCounts, [ean]: 0 },
          inventoryVerified: { ...state.inventoryVerified, [ean]: true }
        }));
        get().markDirty();
      },

      clearInventoryVerification: (ean) => {
        set((state) => {
          const nextCounts = { ...state.inventoryCounts };
          const nextVerified = { ...state.inventoryVerified };
          delete nextCounts[ean];
          delete nextVerified[ean];
          return { inventoryCounts: nextCounts, inventoryVerified: nextVerified };
        });
        get().markDirty();
      },

      resetInventory: () => {
        set({ inventoryCounts: {}, inventoryVerified: {} });
        get().markDirty();
      },

      setStockOverride: (ean, qty) => {
        set((state) => ({
          stockOverrides: {
            ...state.stockOverrides,
            [ean]: Math.max(0, clampFloor(qty))
          }
        }));
        get().markDirty();
      },

      replaceStockOverrides: (overrides) => {
        set({ stockOverrides: overrides });
        get().markDirty();
      },

      approvePriceOverrides: (overrides) => {
        set((state) => ({
          priceOverrides: {
            ...state.priceOverrides,
            ...sanitizePriceOverrides(overrides)
          }
        }));
        get().markDirty();
      },

      setPriceEntry: (ean, entry) => {
        const sanitized = sanitizePriceEntries({ [ean]: entry });
        const nextEntry = sanitized[ean];
        if (!nextEntry) return;

        set((state) => ({
          priceEntries: {
            ...state.priceEntries,
            [ean]: nextEntry
          }
        }));
        get().markDirty();
      },

      replacePriceEntries: (entries) => {
        set({ priceEntries: sanitizePriceEntries(entries) });
        get().markDirty();
      },

      selectBistroProduct: (id) => set({ bistroSelectedId: id }),

      addBistroProduct: (name) => {
        const newProduct: BistroProduct = {
          id: uid("b"),
          name: name.trim(),
          batchUnit: "szt",
          portionQty: 1,
          portionPrice: 0,
          soldQty: 0,
          purchases: []
        };

        set((state) => ({
          bistroProducts: [...state.bistroProducts, newProduct],
          bistroSelectedId: newProduct.id
        }));
        get().markDirty();
      },

      updateBistroProduct: (id, field, value) => {
        set((state) => ({
          bistroProducts: state.bistroProducts.map((product) =>
            product.id === id ? { ...product, [field]: value } : product
          )
        }));
        get().markDirty();
      },

      deleteBistroProduct: (id) => {
        set((state) => {
          const nextProducts = state.bistroProducts.filter((product) => product.id !== id);
          return {
            bistroProducts: nextProducts,
            bistroSelectedId:
              state.bistroSelectedId === id ? (nextProducts[0]?.id ?? null) : state.bistroSelectedId
          };
        });
        get().markDirty();
      },

      resetBistro: () => {
        set({
          bistroProducts: BISTRO_DEFAULTS.map((product) => ({ ...product, purchases: [...product.purchases] })),
          bistroSelectedId: BISTRO_DEFAULTS[0]?.id ?? null
        });
        get().markDirty();
      },

      addPurchase: (productId, purchase) => {
        set((state) => ({
          bistroProducts: state.bistroProducts.map((product) =>
            product.id === productId
              ? {
                  ...product,
                  purchases: [
                    ...product.purchases,
                    {
                      id: uid("purchase"),
                      date: purchase.date || todayStr(),
                      qty: Math.max(0, safeNumber(purchase.qty, 0)),
                      cost: Math.max(0, safeNumber(purchase.cost, 0)),
                      note: String(purchase.note ?? "")
                    }
                  ]
                }
              : product
          )
        }));
        get().markDirty();
      },

      removePurchase: (productId, purchaseId) => {
        set((state) => ({
          bistroProducts: state.bistroProducts.map((product) =>
            product.id === productId
              ? { ...product, purchases: product.purchases.filter((purchase) => purchase.id !== purchaseId) }
              : product
          )
        }));
        get().markDirty();
      },

      markDirty: () => {
        const unsavedChanges = get().unsavedChanges + 1;
        set({
          saveStatus: "dirty",
          unsavedChanges,
          saveLabel: statusLabel("dirty", unsavedChanges)
        });
      },

      setSyncStatus: (status, connectionLabel = get().connectionLabel) => {
        const unsavedChanges = status === "synced" || status === "saved" ? 0 : get().unsavedChanges;
        set({
          saveStatus: status,
          saveLabel: statusLabel(status, unsavedChanges),
          connectionLabel,
          unsavedChanges
        });
      },

      hydrateRemoteSnapshot: (snapshot) => {
        const inventoryCounts = sanitizeInventoryCounts(snapshot.inventory?.counts);
        const inventoryVerified = sanitizeInventoryVerified(snapshot.inventory?.verified, inventoryCounts);
        const bistroProducts = sanitizeBistroProducts(snapshot.bistro?.products);

        set({
          stockOverrides: { ...(snapshot.stock?.overrides ?? {}) },
          priceOverrides: sanitizePriceOverrides(snapshot.prices?.overrides),
          priceEntries: sanitizePriceEntries(snapshot.prices?.entries),
          inventoryCounts,
          inventoryVerified,
          bistroProducts,
          bistroSelectedId: bistroProducts[0]?.id ?? null,
          saveStatus: "synced",
          saveLabel: statusLabel("synced", 0),
          unsavedChanges: 0
        });
      },

      importSnapshot: (snapshot) => {
        const inventoryCounts = sanitizeInventoryCounts(snapshot.inventoryCounts);
        const inventoryVerified = sanitizeInventoryVerified(snapshot.inventoryVerified, inventoryCounts);
        const bistroProducts = sanitizeBistroProducts(snapshot.bistroProducts);

        set({
          stockOverrides: { ...(snapshot.stockOverrides ?? {}) },
          priceOverrides: sanitizePriceOverrides(snapshot.priceOverrides),
          priceEntries: sanitizePriceEntries(snapshot.priceEntries),
          inventoryCounts,
          inventoryVerified,
          bistroProducts,
          bistroSelectedId: snapshot.bistroSelectedId ?? bistroProducts[0]?.id ?? null
        });
        get().markDirty();
      },

      exportSnapshot: () => ({
        version: 1,
        exportedAt: new Date().toISOString(),
        stockOverrides: get().stockOverrides,
        priceOverrides: get().priceOverrides,
        priceEntries: get().priceEntries,
        inventoryCounts: get().inventoryCounts,
        inventoryVerified: get().inventoryVerified,
        bistroProducts: get().bistroProducts,
        bistroSelectedId: get().bistroSelectedId
      })
    }),
    {
      name: "sprawdzarka-react-store",
      partialize: (state) => ({
        filter: state.filter,
        onlyInStock: state.onlyInStock,
        inventoryOnlyDifferences: state.inventoryOnlyDifferences,
        productListView: state.productListView,
        stockOverrides: state.stockOverrides,
        priceOverrides: state.priceOverrides,
        priceEntries: state.priceEntries,
        inventoryCounts: state.inventoryCounts,
        inventoryVerified: state.inventoryVerified,
        bistroProducts: state.bistroProducts,
        bistroSelectedId: state.bistroSelectedId
      })
    }
  )
);
