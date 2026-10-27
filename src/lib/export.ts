import type { Journal } from "./types";
export function csvCell(value: unknown): string {
  let text =
    value == null
      ? ""
      : typeof value === "object"
        ? JSON.stringify(value)
        : String(value);
  if (/^[\s]*[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
}
export function journalCSV(data: Journal): string {
  const rows: Record<string, unknown>[] = [];
  for (const type of [
    "meals",
    "activities",
    "checkins",
    "water",
    "plans",
    "completions",
    "favorites",
  ] as const)
    for (const row of data[type]) rows.push({ type, ...row });
  const columns = [...new Set(rows.flatMap((r) => Object.keys(r)))];
  if (!columns.length) columns.push("type", "id");
  return (
    "\uFEFF" +
    [
      columns.map(csvCell).join(","),
      ...rows.map((row) => columns.map((c) => csvCell(row[c])).join(",")),
    ].join("\r\n")
  );
}
export function downloadCSV(data: Journal) {
  const url = URL.createObjectURL(
    new Blob([journalCSV(data)], { type: "text/csv;charset=utf-8" }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = `fitlog-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
