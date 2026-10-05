type Cell = string | number | null | undefined;

function escape(cell: Cell): string {
  const value = cell === null || cell === undefined ? "" : String(cell);
  return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

/** Build a CSV file in the browser and trigger a download. */
export function downloadCsv(filename: string, rows: Cell[][]) {
  const content = rows.map((row) => row.map(escape).join(",")).join("\n");
  const blob = new Blob([content], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
