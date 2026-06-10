export const DEFAULT_MAX_ABOVE_MARKET = 5;
export const DEFAULT_BELOW_MARKET = 0;

export type MarketPriceStatus = "missing" | "too-high" | "low" | "ok";

export function parseMarketPriceString(value: string): number | null {
  const normalized = value.replace(",", ".").replace(/[^\d.]/g, "");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

export function evaluateMarketPrice(options: {
  marketPrice: number | null;
  sellingPrice: number;
  maxAboveMarket?: number;
  belowMarket?: number;
}): {
  priceTarget: number | null;
  suggestedPrice: number;
  difference: number | null;
  status: MarketPriceStatus;
} {
  const maxAboveMarket = options.maxAboveMarket ?? DEFAULT_MAX_ABOVE_MARKET;
  const belowMarket = options.belowMarket ?? DEFAULT_BELOW_MARKET;
  const marketPrice = options.marketPrice;
  const sellingPrice = options.sellingPrice;

  if (!marketPrice) {
    return {
      priceTarget: null,
      suggestedPrice: sellingPrice,
      difference: null,
      status: "missing"
    };
  }

  const priceTarget = marketPrice * (1 - belowMarket / 100);
  const priceLimit = priceTarget * (1 + maxAboveMarket / 100);
  const suggestedPrice = sellingPrice > priceLimit ? Number(priceLimit.toFixed(2)) : sellingPrice;
  const difference = Math.round((sellingPrice - marketPrice) * 100) / 100;
  const status: MarketPriceStatus =
    sellingPrice > suggestedPrice
      ? "too-high"
      : priceTarget && sellingPrice < priceTarget * 0.9
        ? "low"
        : "ok";

  return { priceTarget, suggestedPrice, difference, status };
}

export function marketPriceStatusLabel(status: MarketPriceStatus): string {
  if (status === "missing") return "Brak danych";
  if (status === "too-high") return "Za drogo";
  if (status === "low") return "Atrakcyjnie";
  return "OK";
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}
