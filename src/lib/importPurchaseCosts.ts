import * as XLSX from "xlsx";
import { normalizeText } from "./utils";
import type { CostMap } from "../types/app";

export type PurchaseImportResult = {
  costs: CostMap;
  vatRates: Record<string, number>;
  imported: number;
  skipped: number;
  sheetNames: string[];
};

function normalizeHeader(value: string): string {
  return normalizeText(String(value ?? "")).replace(/\s+/g, " ").trim();
}

export function parsePrice(value: unknown): number | null {
  if (typeof value === "number") {
    return Number.isFinite(value) && value >= 0 ? Math.round(value * 100) / 100 : null;
  }

  const normalized = String(value ?? "")
    .replace(/\s/g, "")
    .replace(",", ".")
    .replace(/[^\d.]/g, "");

  if (!normalized) return null;

  const parsed = Number(normalized);
  return Number.isFinite(parsed) && parsed >= 0 ? Math.round(parsed * 100) / 100 : null;
}

export function parseVatPercent(value: unknown): number | null {
  if (typeof value === "number") {
    if (!Number.isFinite(value) || value < 0) return null;
    if (value > 0 && value <= 1) return Math.round(value * 10000) / 100;
    return Math.round(value * 100) / 100;
  }

  const raw = String(value ?? "").trim();
  if (!raw) return null;

  const normalized = raw.replace(",", ".").replace("%", "");
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed) || parsed < 0) return null;
  if (parsed > 0 && parsed <= 1) return Math.round(parsed * 10000) / 100;
  return Math.round(parsed * 100) / 100;
}

function findHeaderRow(rows: Array<Array<string | number>>): number {
  return rows.findIndex((row) => {
    const normalized = row.map((cell) => normalizeHeader(String(cell)));
    const hasEan = normalized.some((cell) => cell.includes("ean") || cell.includes("isbn"));
    const hasPurchase = normalized.some(
      (cell) => cell.includes("cena zakupu") || cell.includes("koszt zakupu") || cell.includes("purchase")
    );
    return hasEan && hasPurchase;
  });
}

function findColumnIndexes(header: string[]): { eanIndex: number; costIndex: number; vatIndex: number } {
  const eanIndex = header.findIndex((cell) => cell.includes("ean") || cell.includes("isbn"));
  const costIndex = header.findIndex(
    (cell) =>
      cell.includes("cena zakupu") ||
      cell.includes("koszt zakupu") ||
      (cell.includes("zakup") && cell.includes("netto")) ||
      cell.includes("purchase")
  );
  const vatIndex = header.findIndex((cell) => cell === "vat" || cell.startsWith("vat "));

  return { eanIndex, costIndex, vatIndex };
}

function parseRowsFromSheet(rows: Array<Array<string | number>>): PurchaseImportResult {
  const headerRowIndex = findHeaderRow(rows);
  if (headerRowIndex < 0) {
    return { costs: {}, vatRates: {}, imported: 0, skipped: 0, sheetNames: [] };
  }

  const header = rows[headerRowIndex].map((cell) => normalizeHeader(String(cell)));
  const { eanIndex, costIndex, vatIndex } = findColumnIndexes(header);

  if (eanIndex < 0 || costIndex < 0) {
    return { costs: {}, vatRates: {}, imported: 0, skipped: 0, sheetNames: [] };
  }

  const costs: CostMap = {};
  const vatRates: Record<string, number> = {};
  let imported = 0;
  let skipped = 0;

  for (const row of rows.slice(headerRowIndex + 1)) {
    const ean = String(row[eanIndex] ?? "").replace(/\D/g, "").slice(0, 13);
    const cost = parsePrice(row[costIndex]);
    const vat = vatIndex >= 0 ? parseVatPercent(row[vatIndex]) : null;

    if (!/^\d{13}$/.test(ean)) continue;
    if (cost === null) {
      skipped += 1;
      continue;
    }

    costs[ean] = cost;
    if (vat !== null) vatRates[ean] = vat;
    imported += 1;
  }

  return { costs, vatRates, imported, skipped, sheetNames: [] };
}

export function parsePurchaseCostsWorkbook(buffer: ArrayBuffer): PurchaseImportResult {
  const workbook = XLSX.read(buffer, { type: "array" });
  const mergedCosts: CostMap = {};
  const mergedVatRates: Record<string, number> = {};
  let imported = 0;
  let skipped = 0;

  for (const sheetName of workbook.SheetNames) {
    const worksheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json<Array<string | number>>(worksheet, {
      header: 1,
      defval: "",
      raw: true
    }) as Array<Array<string | number>>;

    const parsed = parseRowsFromSheet(rows);
    Object.assign(mergedCosts, parsed.costs);
    Object.assign(mergedVatRates, parsed.vatRates);
    imported += parsed.imported;
    skipped += parsed.skipped;
  }

  return {
    costs: mergedCosts,
    vatRates: mergedVatRates,
    imported,
    skipped,
    sheetNames: workbook.SheetNames
  };
}

export function parsePurchaseCostsSheet(rows: Array<Array<string | number>>): PurchaseImportResult {
  const parsed = parseRowsFromSheet(rows);
  return { ...parsed, sheetNames: ["sheet"] };
}
