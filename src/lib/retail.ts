export function retailRound(value: number, precision = 2): number {
  const factor = 10 ** precision;
  return Math.round((Number(value) || 0) * factor) / factor;
}

export type RetailMarginStatus = "profit" | "loss" | "break-even" | "unknown";

export function calcPurchaseGross(
  purchaseCostNet: number,
  vatPercent: number | null | undefined = null
): number {
  const vat = vatPercent ?? 23;
  return retailRound(purchaseCostNet * (1 + vat / 100));
}

export function calcPurchaseNetFromGross(
  purchaseCostGross: number,
  vatPercent: number | null | undefined = null
): number {
  const vat = vatPercent ?? 23;
  return retailRound(purchaseCostGross / (1 + vat / 100));
}

export function calcRetailMargin(
  sellingPriceGross: number,
  purchaseCostNet: number | null | undefined,
  vatPercent: number | null | undefined = null
): {
  profit: number | null;
  marginPct: number | null;
  purchaseGross: number | null;
  status: RetailMarginStatus;
} {
  if (
    purchaseCostNet === null ||
    purchaseCostNet === undefined ||
    !Number.isFinite(purchaseCostNet) ||
    purchaseCostNet < 0
  ) {
    return { profit: null, marginPct: null, purchaseGross: null, status: "unknown" };
  }

  const purchaseGross = calcPurchaseGross(purchaseCostNet, vatPercent);
  const profit = retailRound(sellingPriceGross - purchaseGross);
  const marginPct = sellingPriceGross > 0 ? retailRound((profit / sellingPriceGross) * 100, 1) : null;

  if (profit > 0) return { profit, marginPct, purchaseGross, status: "profit" };
  if (profit < 0) return { profit, marginPct, purchaseGross, status: "loss" };
  return { profit, marginPct, purchaseGross, status: "break-even" };
}

export function retailSummaryCalc(
  rows: Array<{ sellingPrice: number; purchaseCost: number | null; vatPercent?: number | null }>
): {
  withCost: number;
  profitable: number;
  losing: number;
  missingCost: number;
  avgMarginPct: number | null;
} {
  let withCost = 0;
  let profitable = 0;
  let losing = 0;
  let missingCost = 0;
  let marginSum = 0;
  let marginCount = 0;

  for (const row of rows) {
    const calc = calcRetailMargin(row.sellingPrice, row.purchaseCost, row.vatPercent);
    if (calc.status === "unknown") {
      missingCost += 1;
      continue;
    }

    withCost += 1;
    if (calc.status === "profit") profitable += 1;
    if (calc.status === "loss") losing += 1;
    if (calc.marginPct !== null) {
      marginSum += calc.marginPct;
      marginCount += 1;
    }
  }

  return {
    withCost,
    profitable,
    losing,
    missingCost,
    avgMarginPct: marginCount > 0 ? retailRound(marginSum / marginCount, 1) : null
  };
}
