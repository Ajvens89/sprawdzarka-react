import type { Product } from "../../types/app";

export function productTitle(product: Product): string {
  const record = product as unknown as Record<string, unknown>;
  const title = Object.entries(record).find(([key]) => key !== "ean" && key !== "cena")?.[1];
  return String(title ?? "");
}

export function parsePrice(value: string): number | null {
  const normalized = value.replace(",", ".").replace(/[^\d.]/g, "");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

export function searchUrl(product: Product, target: "google" | "ceneo" | "allegro"): string {
  const titleQuery = encodeURIComponent(productTitle(product));
  const fullQuery = encodeURIComponent(`${product.ean} ${productTitle(product)}`);
  if (target === "google") return `https://www.google.pl/search?tbm=shop&q=${fullQuery}`;
  if (target === "ceneo") return `https://www.ceneo.pl/;szukaj-${titleQuery}`;
  return `https://allegro.pl/listing?string=${fullQuery}&description=1`;
}

export type PriceRowStatus = "missing" | "too-high" | "ok" | "low";

export function priceStatusLabel(status: PriceRowStatus): string {
  if (status === "missing") return "Brak danych";
  if (status === "too-high") return "Za drogo";
  if (status === "low") return "Atrakcyjna";
  return "OK";
}
