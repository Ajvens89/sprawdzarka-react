import type { PriceEntry } from "../types/app";

export const DEFAULT_PRICE_CACHE_HOURS = 72;

function parsePolishDateTime(value: string): Date | null {
  const match = value.match(/(\d{1,2})\.(\d{1,2})\.(\d{4}),?\s*(\d{1,2}):(\d{2})(?::(\d{2}))?/);
  if (!match) return null;

  const [, day, month, year, hour, minute, second = "0"] = match;
  const parsed = new Date(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hour),
    Number(minute),
    Number(second)
  );

  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function parseCheckedAt(checkedAt?: string): Date | null {
  if (!checkedAt) return null;

  const native = new Date(checkedAt);
  if (!Number.isNaN(native.getTime())) return native;

  return parsePolishDateTime(checkedAt);
}

export function isPriceEntryFresh(entry: PriceEntry | undefined, maxAgeHours = DEFAULT_PRICE_CACHE_HOURS): boolean {
  if (!entry?.marketPrice?.trim() || !entry.checkedAt) return false;

  const checkedAt = parseCheckedAt(entry.checkedAt);
  if (!checkedAt) return false;

  return Date.now() - checkedAt.getTime() < maxAgeHours * 60 * 60 * 1000;
}

export function formatPriceCacheAge(entry: PriceEntry | undefined): string | null {
  const checkedAt = parseCheckedAt(entry?.checkedAt);
  if (!checkedAt) return null;

  const hours = Math.max(1, Math.round((Date.now() - checkedAt.getTime()) / (60 * 60 * 1000)));
  if (hours < 24) return `${hours} h temu`;
  const days = Math.round(hours / 24);
  return `${days} d temu`;
}
