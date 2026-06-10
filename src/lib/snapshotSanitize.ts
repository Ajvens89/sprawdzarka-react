import type { StockMap } from "../types/app";
import { clampFloor } from "./utils";

export function sanitizeStockOverrides(value: unknown): StockMap {
  if (!value || typeof value !== "object") return {};

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .map(([ean, qty]) => [ean.replace(/\D/g, "").slice(0, 13), clampFloor(Number(qty))] as const)
      .filter(([ean]) => /^\d{13}$/.test(ean))
  );
}
