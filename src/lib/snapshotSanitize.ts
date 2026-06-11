import { BISTRO_DEFAULTS, REMOVED_BISTRO_PRODUCT_IDS } from "../data/bistroDefaults";
import type {
  BistroProduct,
  CostMap,
  InventoryCountsMap,
  InventoryVerifiedMap,
  PriceEntriesMap,
  PriceEntry,
  PriceMap,
  StockMap,
  VatMap
} from "../types/app";
import { clampFloor, safeNumber, todayStr, uid } from "./utils";

export function sanitizeStockOverrides(value: unknown): StockMap {
  if (!value || typeof value !== "object") return {};

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .map(([ean, qty]) => [ean.replace(/\D/g, "").slice(0, 13), clampFloor(Number(qty))] as const)
      .filter(([ean]) => /^\d{13}$/.test(ean))
  );
}

export function sanitizeInventoryCounts(value: unknown): InventoryCountsMap {
  if (!value || typeof value !== "object") return {};

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .map(([ean, qty]) => [ean.replace(/\D/g, "").slice(0, 13), clampFloor(Number(qty))] as const)
      .filter(([ean]) => /^\d{13}$/.test(ean))
  );
}

export function sanitizePriceOverrides(value: unknown): PriceMap {
  if (!value || typeof value !== "object") return {};

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .map(([ean, price]) => [ean.replace(/\D/g, "").slice(0, 13), Math.round(safeNumber(price, 0) * 100) / 100] as const)
      .filter(([ean, price]) => /^\d{13}$/.test(ean) && price > 0)
  );
}

export function sanitizePurchaseCosts(value: unknown): CostMap {
  if (!value || typeof value !== "object") return {};

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .map(([ean, cost]) => [ean.replace(/\D/g, "").slice(0, 13), Math.round(safeNumber(cost, 0) * 100) / 100] as const)
      .filter(([ean, cost]) => /^\d{13}$/.test(ean) && cost >= 0)
  );
}

export function sanitizePurchaseVatRates(value: unknown): VatMap {
  if (!value || typeof value !== "object") return {};

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .map(([ean, vat]) => {
        const normalizedEan = ean.replace(/\D/g, "").slice(0, 13);
        const numeric = safeNumber(vat, -1);
        const percent = numeric > 0 && numeric <= 1 ? numeric * 100 : numeric;
        return [normalizedEan, Math.round(percent * 100) / 100] as const;
      })
      .filter(([ean, vat]) => /^\d{13}$/.test(ean) && vat >= 0 && vat <= 100)
  );
}

export function sanitizePriceEntries(value: unknown): PriceEntriesMap {
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

export function sanitizeInventoryVerified(
  value: unknown,
  counts: InventoryCountsMap
): InventoryVerifiedMap {
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

function cloneBistroProduct(product: BistroProduct): BistroProduct {
  return { ...product, purchases: [...product.purchases] };
}

function mergeBistroProducts(remoteProducts: BistroProduct[]): BistroProduct[] {
  const defaults = BISTRO_DEFAULTS.map(cloneBistroProduct);
  const defaultIds = new Set(defaults.map((product) => product.id));
  const remoteById = new Map(remoteProducts.map((product) => [product.id, product]));

  const mergedDefaults = defaults.map((product) => remoteById.get(product.id) ?? product);
  const customProducts = remoteProducts.filter(
    (product) => !defaultIds.has(product.id) && !REMOVED_BISTRO_PRODUCT_IDS.has(product.id)
  );

  return [...mergedDefaults, ...customProducts.map(cloneBistroProduct)];
}

export function sanitizeBistroProducts(value: unknown): BistroProduct[] {
  if (!Array.isArray(value) || value.length === 0) {
    return BISTRO_DEFAULTS.map(cloneBistroProduct);
  }

  const parsed = value
    .filter((item) => !REMOVED_BISTRO_PRODUCT_IDS.has(String((item as BistroProduct).id ?? "")))
    .map((item, index) => ({
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

  if (parsed.length === 0) {
    return BISTRO_DEFAULTS.map(cloneBistroProduct);
  }

  return mergeBistroProducts(parsed);
}
