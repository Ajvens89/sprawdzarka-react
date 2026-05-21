import type { BistroProduct, BistroPurchase } from "../types/app";

export function bistroRound(value: number, precision = 3): number {
  const factor = 10 ** precision;
  return Math.round((Number(value) || 0) * factor) / factor;
}

export function bistroCalcProduct(product: BistroProduct): {
  batchQty: number;
  batchCost: number;
  revenue: number;
  costPerUnit: number | null;
  costPerPortion: number | null;
  profit: number;
  margin: number | null;
  theoreticalLeft: number;
} {
  const batchQty = product.purchases.reduce((sum, purchase) => sum + purchase.qty, 0);
  const batchCost = product.purchases.reduce((sum, purchase) => sum + purchase.cost, 0);
  const revenue = product.soldQty * product.portionPrice;
  const costPerUnit = batchQty > 0 ? batchCost / batchQty : null;
  const costPerPortion = costPerUnit !== null ? costPerUnit * product.portionQty : null;
  const totalPortionCost = costPerPortion !== null ? costPerPortion * product.soldQty : 0;
  const profit = revenue - totalPortionCost;
  const margin = revenue > 0 ? (profit / revenue) * 100 : null;
  const theoreticalLeft = batchQty - product.soldQty * product.portionQty;

  return {
    batchQty: bistroRound(batchQty),
    batchCost: bistroRound(batchCost, 2),
    revenue: bistroRound(revenue, 2),
    costPerUnit: costPerUnit === null ? null : bistroRound(costPerUnit, 4),
    costPerPortion: costPerPortion === null ? null : bistroRound(costPerPortion, 4),
    profit: bistroRound(profit, 2),
    margin: margin === null ? null : bistroRound(margin, 2),
    theoreticalLeft: bistroRound(theoreticalLeft)
  };
}

export function bistroSummaryCalc(products: BistroProduct[]): {
  totalRevenue: number;
  totalCost: number;
  totalProfit: number;
  margin: number | null;
} {
  const summary = products.reduce(
    (acc, product) => {
      const calc = bistroCalcProduct(product);
      acc.totalRevenue += calc.revenue;
      acc.totalCost += product.soldQty * (calc.costPerPortion ?? 0);
      acc.totalProfit += calc.profit;
      return acc;
    },
    { totalRevenue: 0, totalCost: 0, totalProfit: 0 }
  );

  return {
    totalRevenue: bistroRound(summary.totalRevenue, 2),
    totalCost: bistroRound(summary.totalCost, 2),
    totalProfit: bistroRound(summary.totalProfit, 2),
    margin: summary.totalRevenue > 0 ? bistroRound((summary.totalProfit / summary.totalRevenue) * 100, 2) : null
  };
}

export function clonePurchases(purchases: BistroPurchase[]): BistroPurchase[] {
  return purchases.map((purchase) => ({ ...purchase }));
}
