import { BASE_PRODUCTS } from "../data/products";
import { BASE_STOCK } from "../data/stock";
import type {
  InventoryCountsMap,
  InventoryEntry,
  InventoryVerifiedMap,
  Product,
  PriceMap,
  StockMap,
  StockState
} from "../types/app";
import { formatPrice, hasOwn, normalizeEAN, normalizeText } from "./utils";

export function getResolvedStock(stockOverrides: StockMap): StockMap {
  return {
    ...BASE_STOCK,
    ...stockOverrides
  };
}

export function getResolvedProducts(priceOverrides: PriceMap): Product[] {
  return LEGACY_PRODUCTS.map((product) => {
    const override = priceOverrides[product.ean];
    return Number.isFinite(override) && override > 0 ? { ...product, cena: override } : product;
  });
}

export function getProductsByEan(products: Product[]): Map<string, Product> {
  return new Map(products.map((product) => [product.ean, product]));
}

export function getStockState(ean: string, stock: StockMap): StockState {
  if (!hasOwn(stock, ean)) {
    return {
      className: "unknown-stock",
      label: "? Stan nieznany",
      shortLabel: "stan nieznany",
      sortWeight: 3
    };
  }

  const qty = stock[ean];
  if (qty === 0) {
    return {
      className: "out-stock",
      label: "✕ Brak na stanie",
      shortLabel: "brak",
      sortWeight: 2
    };
  }

  if (qty <= 3) {
    return {
      className: "low-stock",
      label: `⚠ Ostatnie ${qty} szt. na stanie`,
      shortLabel: `⚠ ${qty} szt.`,
      sortWeight: 1
    };
  }

  return {
    className: "in-stock",
    label: `✓ Na stanie: ${qty} szt.`,
    shortLabel: `${qty} szt.`,
    sortWeight: 0
  };
}

export function buildInventoryEntry(
  product: Product,
  stock: StockMap,
  inventoryCounts: InventoryCountsMap,
  inventoryVerified: InventoryVerifiedMap
): InventoryEntry {
  const qty = inventoryCounts[product.ean] ?? 0;
  const verified = Boolean(inventoryVerified[product.ean]);
  const stockKnown = hasOwn(stock, product.ean);
  const baseline = stockKnown ? stock[product.ean] : null;
  const difference =
    verified && stockKnown && baseline !== null ? qty - baseline : null;
  const matches = verified && difference === 0;
  const hasDifference = verified && difference !== null && difference !== 0;

  return {
    ean: product.ean,
    qty,
    verified,
    product,
    baseline,
    difference,
    matches,
    hasDifference,
    stockKnown
  };
}

export function getInventoryEntries(
  products: Product[],
  stock: StockMap,
  inventoryCounts: InventoryCountsMap,
  inventoryVerified: InventoryVerifiedMap,
  onlyDifferences: boolean
): InventoryEntry[] {
  return products
    .map((product) => buildInventoryEntry(product, stock, inventoryCounts, inventoryVerified))
    .filter((entry) => !onlyDifferences || entry.hasDifference)
    .sort((a, b) => {
      if (a.verified !== b.verified) return a.verified ? -1 : 1;
      if (a.hasDifference !== b.hasDifference) return a.hasDifference ? -1 : 1;
      if (b.qty !== a.qty) return b.qty - a.qty;
      return a.product.tytuł.localeCompare(b.product.tytuł, "pl");
    });
}

export function getInventorySummary(
  products: Product[],
  stock: StockMap,
  inventoryCounts: InventoryCountsMap,
  inventoryVerified: InventoryVerifiedMap
): {
  verifiedCount: number;
  differenceCount: number;
  totalScanned: number;
  unknownStockCount: number;
} {
  const entries = getInventoryEntries(products, stock, inventoryCounts, inventoryVerified, false);

  return {
    verifiedCount: entries.filter((entry) => entry.verified).length,
    differenceCount: entries.filter((entry) => entry.hasDifference).length,
    totalScanned: Object.values(inventoryCounts).reduce((sum, qty) => sum + qty, 0),
    unknownStockCount: entries.filter((entry) => !entry.stockKnown).length
  };
}

export function filterProducts(
  products: Product[],
  filter: string,
  onlyInStock: boolean,
  stock: StockMap
): Product[] {
  const query = normalizeText(filter);

  return products.filter((product) => {
    const matchesText = !query
      || normalizeText(product.tytuł).includes(query)
      || product.ean.includes(query);

    const matchesStock = !onlyInStock || (hasOwn(stock, product.ean) && stock[product.ean] > 0);
    return matchesText && matchesStock;
  });
}

export function findProductByEan(ean: string): Product | null {
  return BASE_PRODUCTS.find((product) => product.ean === ean) ?? null;
}

export function formatInventoryDifference(difference: number | null, verified: boolean): {
  className: "positive" | "negative" | "neutral";
  label: string;
} {
  if (!verified) {
    return { className: "neutral", label: "nie sprawdzono" };
  }

  if (difference === null) {
    return { className: "neutral", label: "brak porównania" };
  }

  if (difference === 0) {
    return { className: "positive", label: "zgodne" };
  }

  const sign = difference > 0 ? "+" : "";
  return { className: "negative", label: `różnica ${sign}${difference}` };
}

export function renderFoundPrice(price: number): [string, string] {
  const [whole, decimal] = formatPrice(price).split(",");
  return [whole, decimal];
}

export function uniqueProducts(products: Product[]): Product[] {
  const seen = new Set<string>();
  const unique: Product[] = [];
  for (const product of products) {
    if (seen.has(product.ean)) continue;
    seen.add(product.ean);
    unique.push(product);
  }
  return unique;
}

export const LEGACY_PRODUCTS = uniqueProducts(BASE_PRODUCTS);

export type EanLookupResult =
  | { type: "empty" }
  | { type: "invalid" }
  | { type: "not_found"; ean: string }
  | { type: "found"; product: Product };

export function isValidEan13(ean: string): boolean {
  if (!/^\d{13}$/.test(ean)) return false;

  let sum = 0;
  for (let index = 0; index < 12; index += 1) {
    const digit = Number(ean[index]);
    sum += index % 2 === 0 ? digit : digit * 3;
  }

  const checkDigit = (10 - (sum % 10)) % 10;
  return checkDigit === Number(ean[12]);
}

export function lookupEanInCatalog(raw: string, products: Product[]): EanLookupResult {
  const query = normalizeEAN(raw);

  if (!query) return { type: "empty" };
  if (!/^\d{13}$/.test(query) || !isValidEan13(query)) return { type: "invalid" };

  const product = products.find((item) => item.ean === query);
  if (!product) return { type: "not_found", ean: query };

  return { type: "found", product };
}
