import type { BistroProduct, RemoteSnapshot } from "../types/app";

function mergeRecords<T extends Record<string, unknown>>(
  remote: T | undefined,
  local: T | undefined
): T {
  return { ...(remote ?? {}), ...(local ?? {}) } as T;
}

function mergePurchases(
  remote: BistroProduct["purchases"],
  local: BistroProduct["purchases"]
): BistroProduct["purchases"] {
  const byId = new Map<string, BistroProduct["purchases"][number]>();
  for (const purchase of remote ?? []) {
    byId.set(purchase.id, purchase);
  }
  for (const purchase of local ?? []) {
    byId.set(purchase.id, purchase);
  }
  return [...byId.values()];
}

function mergeBistroProducts(
  remote: BistroProduct[] | undefined,
  local: BistroProduct[] | undefined
): BistroProduct[] {
  const remoteList = Array.isArray(remote) ? remote : [];
  const localList = Array.isArray(local) ? local : [];
  const byId = new Map<string, BistroProduct>();

  for (const product of remoteList) {
    byId.set(product.id, product);
  }

  for (const localProduct of localList) {
    const remoteProduct = byId.get(localProduct.id);
    if (!remoteProduct) {
      byId.set(localProduct.id, localProduct);
      continue;
    }

    byId.set(localProduct.id, {
      ...remoteProduct,
      ...localProduct,
      soldQty: Math.max(remoteProduct.soldQty ?? 0, localProduct.soldQty ?? 0),
      purchases: mergePurchases(remoteProduct.purchases, localProduct.purchases)
    });
  }

  return [...byId.values()];
}

/** Scala zdalny snapshot z lokalnym — lokalne mapy wygrywają przy konflikcie klucza. */
export function mergeRemoteSnapshots(
  remote: RemoteSnapshot | null | undefined,
  local: Omit<RemoteSnapshot, "updatedAt">,
  updatedAt: number = Date.now()
): RemoteSnapshot {
  return {
    stock: {
      overrides: mergeRecords(remote?.stock?.overrides, local.stock?.overrides)
    },
    prices: {
      overrides: mergeRecords(remote?.prices?.overrides, local.prices?.overrides),
      entries: mergeRecords(remote?.prices?.entries, local.prices?.entries)
    },
    costs: {
      purchase: mergeRecords(remote?.costs?.purchase, local.costs?.purchase),
      vat: mergeRecords(remote?.costs?.vat, local.costs?.vat)
    },
    inventory: {
      counts: mergeRecords(remote?.inventory?.counts, local.inventory?.counts),
      verified: mergeRecords(remote?.inventory?.verified, local.inventory?.verified)
    },
    bistro: {
      products: mergeBistroProducts(remote?.bistro?.products, local.bistro?.products)
    },
    updatedAt
  };
}
