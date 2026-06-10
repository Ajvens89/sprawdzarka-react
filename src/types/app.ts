export type AppTab = "scanner" | "bistro";

export type Product = {
  tytuł: string;
  ean: string;
  cena: number;
};

export type StockMap = Record<string, number>;
export type PriceMap = Record<string, number>;
export type CostMap = Record<string, number>;
export type VatMap = Record<string, number>;

export type PriceEntry = {
  marketPrice: string;
  source: string;
  checkedAt?: string;
  status?: string;
};

export type PriceEntriesMap = Record<string, PriceEntry>;

export type InventoryCountsMap = Record<string, number>;
export type InventoryVerifiedMap = Record<string, boolean>;

export type BistroUnit = "g" | "kg" | "ml" | "l" | "szt";

export type BistroPurchase = {
  id: string;
  date: string;
  qty: number;
  cost: number;
  note: string;
};

export type BistroProduct = {
  id: string;
  name: string;
  batchUnit: BistroUnit;
  portionQty: number;
  portionPrice: number;
  soldQty: number;
  purchases: BistroPurchase[];
};

export type SaveStatus = "idle" | "dirty" | "saving" | "saved" | "synced" | "offline";

export type StockState = {
  className: "unknown-stock" | "out-stock" | "low-stock" | "in-stock";
  label: string;
  shortLabel: string;
  sortWeight: number;
};

export type InventoryEntry = {
  ean: string;
  qty: number;
  verified: boolean;
  product: Product;
  baseline: number | null;
  difference: number | null;
  matches: boolean;
  hasDifference: boolean;
  stockKnown: boolean;
};

export type ClientExportSnapshot = {
  title: string;
  receiptTotalInput: string;
  notes: string;
  deductionItems: Array<{
    id: string;
    title: string;
    qty: number;
    unitPrice: number;
    notes?: string;
  }>;
  remainingItems: Array<{
    id: string;
    title: string;
    qty: number;
    unitPrice: number;
    notes?: string;
  }>;
  targetList: "deduction" | "remaining";
};

export type AppSnapshot = {
  version: number;
  exportedAt: string;
  stockOverrides: StockMap;
  priceOverrides: PriceMap;
  purchaseCosts: CostMap;
  purchaseVatRates: VatMap;
  priceEntries: PriceEntriesMap;
  inventoryCounts: InventoryCountsMap;
  inventoryVerified: InventoryVerifiedMap;
  bistroProducts: BistroProduct[];
  bistroSelectedId: string | null;
  clientExport?: ClientExportSnapshot;
};

export type RemoteSnapshot = {
  stock?: {
    overrides?: StockMap;
  };
  prices?: {
    overrides?: PriceMap;
    entries?: PriceEntriesMap;
  };
  costs?: {
    purchase?: CostMap;
    vat?: VatMap;
  };
  inventory?: {
    counts?: InventoryCountsMap;
    verified?: InventoryVerifiedMap;
  };
  bistro?: {
    products?: BistroProduct[];
  };
  updatedAt?: number;
};
