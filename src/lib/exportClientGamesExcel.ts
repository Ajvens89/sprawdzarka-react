import * as XLSX from "xlsx";
import { xlsxDownloadWorkbook, type WorkbookSheet } from "./export";
import { todayStr } from "./utils";

export type ClientGameLine = {
  title: string;
  qty: number;
  unitPrice: number;
  notes?: string;
};

export type ClientGamesExportInput = {
  title?: string;
  receiptTotal: number;
  deductionItems: ClientGameLine[];
  remainingItems: ClientGameLine[];
  notes?: string;
  filename?: string;
};

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

export function calcClientLineTotal(line: Pick<ClientGameLine, "qty" | "unitPrice">): number {
  return roundMoney(line.qty * line.unitPrice);
}

export function calcClientListTotal(items: ClientGameLine[]): number {
  return roundMoney(items.reduce((sum, item) => sum + calcClientLineTotal(item), 0));
}

export function calcClientControlDiff(
  receiptTotal: number,
  deductionTotal: number,
  remainingTotal: number
): number {
  return roundMoney(receiptTotal - deductionTotal - remainingTotal);
}

function buildListSheet(
  heading: string,
  items: ClientGameLine[],
  total: number
): Array<Array<string | number>> {
  const rows: Array<Array<string | number>> = [
    [heading, "", "", "", ""],
    ["Gra", "Ilość", "Cena/szt. [zł]", "Razem [zł]", "Uwagi"]
  ];

  for (const item of items) {
    rows.push([
      item.title,
      item.qty,
      item.unitPrice,
      calcClientLineTotal(item),
      item.notes ?? ""
    ]);
  }

  rows.push(["", "", "", "RAZEM", total]);
  return rows;
}

export function buildClientGamesWorkbook(input: ClientGamesExportInput): WorkbookSheet[] {
  const title = input.title?.trim() || "Rozliczenie paragonu – gry";
  const deductionTotal = calcClientListTotal(input.deductionItems);
  const remainingTotal = calcClientListTotal(input.remainingItems);
  const controlDiff = calcClientControlDiff(input.receiptTotal, deductionTotal, remainingTotal);
  const notes = input.notes?.trim() ?? "";

  const summaryRows: Array<Array<string | number>> = [
    [title, "", "", ""],
    ["", "", "", ""],
    ["Pozycja", "Kwota [zł]", "Opis", "Kontrola"],
    ["Suma paragonu", input.receiptTotal, "Kwota z paragonu", ""],
    ["Do skasowania klienta", deductionTotal, "Lista podana przez Ciebie", ""],
    ["Zostało z paragonu", remainingTotal, "Po odjęciu listy", ""],
    ["Różnica kontrolna", controlDiff, "Powinno wyjść 0 zł", controlDiff === 0 ? "" : "SPRAWDŹ"],
    ["", "", "", ""],
    ["", "", "", ""],
    ["Uwagi", "", "", ""]
  ];

  if (notes) {
    summaryRows.push([notes, "", "", ""]);
  }

  return [
    { name: "Podsumowanie", rows: summaryRows },
    {
      name: "Do skasowania",
      rows: buildListSheet("Gry do skasowania klienta", input.deductionItems, deductionTotal)
    },
    {
      name: "Zostało",
      rows: buildListSheet("Co zostało po odjęciu listy", input.remainingItems, remainingTotal)
    }
  ];
}

export function downloadClientGamesExcel(input: ClientGamesExportInput): void {
  const filename = input.filename ?? `gry-${todayStr()}.xlsx`;
  xlsxDownloadWorkbook(buildClientGamesWorkbook(input), filename);
}

function parseNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return roundMoney(value);
  const normalized = String(value ?? "").replace(",", ".").replace(/[^\d.-]/g, "");
  if (!normalized) return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? roundMoney(parsed) : null;
}

function normalizeHeader(value: unknown): string {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim();
}

function findHeaderRow(rows: Array<Array<string | number>>): number {
  return rows.findIndex((row) => {
    const cells = row.map(normalizeHeader);
    return cells.some((cell) => cell === "gra" || cell.includes("tytul") || cell.includes("produkt"));
  });
}

export function parseClientGameLines(rows: Array<Array<string | number>>): ClientGameLine[] {
  const headerIndex = findHeaderRow(rows);
  if (headerIndex < 0) return [];

  const header = rows[headerIndex].map(normalizeHeader);
  const titleIndex = header.findIndex(
    (cell) => cell === "gra" || cell.includes("tytul") || cell.includes("produkt") || cell.includes("nazwa")
  );
  const qtyIndex = header.findIndex((cell) => cell.includes("ilosc") || cell === "szt");
  const priceIndex = header.findIndex(
    (cell) => cell.includes("cena") && !cell.includes("razem") && !cell.includes("suma")
  );
  const notesIndex = header.findIndex((cell) => cell.includes("uwag"));

  if (titleIndex < 0 || qtyIndex < 0 || priceIndex < 0) return [];

  const items: ClientGameLine[] = [];

  for (const row of rows.slice(headerIndex + 1)) {
    const title = String(row[titleIndex] ?? "").trim();
    if (!title || normalizeHeader(title) === "razem") continue;

    const qty = parseNumber(row[qtyIndex]);
    const unitPrice = parseNumber(row[priceIndex]);
    if (qty === null || unitPrice === null || qty <= 0) continue;

    items.push({
      title,
      qty: Math.round(qty),
      unitPrice,
      notes: notesIndex >= 0 ? String(row[notesIndex] ?? "").trim() : ""
    });
  }

  return items;
}

export function parseClientGamesWorkbook(buffer: ArrayBuffer): {
  deductionItems: ClientGameLine[];
  remainingItems: ClientGameLine[];
  receiptTotal: number | null;
} {
  const workbook = XLSX.read(buffer, { type: "array" });
  let deductionItems: ClientGameLine[] = [];
  let remainingItems: ClientGameLine[] = [];
  let receiptTotal: number | null = null;

  for (const sheetName of workbook.SheetNames) {
    const rows = XLSX.utils.sheet_to_json<Array<string | number>>(workbook.Sheets[sheetName], {
      header: 1,
      defval: "",
      raw: true
    }) as Array<Array<string | number>>;

    const normalizedName = normalizeHeader(sheetName);
    if (normalizedName.includes("skasow") || normalizedName.includes("kasow")) {
      deductionItems = parseClientGameLines(rows);
      continue;
    }

    if (normalizedName.includes("zostal")) {
      remainingItems = parseClientGameLines(rows);
      continue;
    }

    if (normalizedName.includes("podsum")) {
      for (const row of rows) {
        const label = normalizeHeader(row[0]);
        if (label.includes("suma paragonu")) {
          receiptTotal = parseNumber(row[1]);
        }
      }
    }
  }

  if (deductionItems.length === 0 && remainingItems.length === 0 && workbook.SheetNames[0]) {
    deductionItems = parseClientGameLines(
      XLSX.utils.sheet_to_json<Array<string | number>>(workbook.Sheets[workbook.SheetNames[0]], {
        header: 1,
        defval: "",
        raw: true
      }) as Array<Array<string | number>>
    );
  }

  return { deductionItems, remainingItems, receiptTotal };
}
