import ExcelJS from "exceljs";

export async function generateExcel(
  columns: string[],
  rows: Record<string, unknown>[],
  title: string
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet(title.slice(0, 31)); // Excel limit

  // Add headers
  sheet.columns = columns.map((col) => ({
    header: col,
    key: col,
    width: Math.max(10, Math.min(50, col.length + 5)),
  }));

  // Style headers
  const headerRow = sheet.getRow(1);
  headerRow.font = { name: "Arial", size: 10, bold: true };
  headerRow.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFE8E8E8" },
  };

  // Add data rows
  for (const row of rows) {
    const values: Record<string, unknown> = {};
    for (const col of columns) {
      const val = row[col];
      values[col] = val === null || val === undefined ? "" : String(val);
    }
    sheet.addRow(values);
  }

  // Auto-fit widths based on content
  for (const column of sheet.columns) {
    let maxLen = String(column.header ?? "").length;
    column.eachCell?.({ includeEmpty: false }, (cell) => {
      const len = String(cell.value ?? "").length;
      if (len > maxLen) maxLen = len;
    });
    column.width = Math.max(10, Math.min(50, maxLen + 2));
  }

  // Freeze header row
  sheet.views = [{ state: "frozen", xSplit: 0, ySplit: 1 }];

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

function escapeCsvValue(val: unknown): string {
  const str = val === null || val === undefined ? "" : String(val);
  if (str.includes(",") || str.includes("\n") || str.includes('"')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function generateCsv(
  columns: string[],
  rows: Record<string, unknown>[]
): string {
  const header = columns.map(escapeCsvValue).join(",");
  const dataRows = rows.map((row) =>
    columns.map((col) => escapeCsvValue(row[col])).join(",")
  );
  return [header, ...dataRows].join("\n");
}
