import * as XLSX from "xlsx";

export function xlsxDownload(rows: Array<Array<string | number>>, filename: string, sheetName = "Dane"): void {
  const workbook = XLSX.utils.book_new();
  const worksheet = XLSX.utils.aoa_to_sheet(rows);

  const colWidths = rows[0]?.map((_, columnIndex) => {
    const maxLength = Math.max(
      10,
      ...rows.map((row) => String(row[columnIndex] ?? "").length)
    );
    return { wch: Math.min(60, maxLength + 2) };
  }) ?? [];

  worksheet["!cols"] = colWidths;

  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
  XLSX.writeFile(workbook, filename);
}
