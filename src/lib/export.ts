import * as XLSX from "xlsx";

export type WorkbookSheet = {
  name: string;
  rows: Array<Array<string | number>>;
};

function applyColumnWidths(rows: Array<Array<string | number>>): Array<{ wch: number }> {
  const columnCount = Math.max(0, ...rows.map((row) => row.length));

  return Array.from({ length: columnCount }, (_, columnIndex) => {
    const maxLength = Math.max(
      10,
      ...rows.map((row) => String(row[columnIndex] ?? "").length)
    );
    return { wch: Math.min(60, maxLength + 2) };
  });
}

export function xlsxDownloadWorkbook(sheets: WorkbookSheet[], filename: string): void {
  const workbook = XLSX.utils.book_new();

  for (const sheet of sheets) {
    const worksheet = XLSX.utils.aoa_to_sheet(sheet.rows);
    worksheet["!cols"] = applyColumnWidths(sheet.rows);
    XLSX.utils.book_append_sheet(workbook, worksheet, sheet.name.slice(0, 31));
  }

  XLSX.writeFile(workbook, filename);
}

export function xlsxDownload(rows: Array<Array<string | number>>, filename: string, sheetName = "Dane"): void {
  xlsxDownloadWorkbook([{ name: sheetName, rows }], filename);
}

export function xlsxReadFirstSheet(file: ArrayBuffer): Array<Array<string | number>> {
  const workbook = XLSX.read(file, { type: "array" });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) return [];

  const worksheet = workbook.Sheets[sheetName];
  return XLSX.utils.sheet_to_json<Array<string | number>>(worksheet, {
    header: 1,
    defval: "",
    raw: false
  }) as Array<Array<string | number>>;
}
