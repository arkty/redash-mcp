import { writeFile, mkdir } from "node:fs/promises";
import { join, resolve } from "node:path";
import type { RedashQueryResult } from "../client/types.js";

export interface JsonFormattedResult {
  columns: Array<{ name: string; type: string }>;
  rows: Record<string, unknown>[];
  total_rows: number;
  returned_rows: number;
  truncated: boolean;
  runtime: number;
  retrieved_at: string;
}

export function formatJsonResult(
  result: RedashQueryResult,
  maxRows: number,
): JsonFormattedResult {
  const totalRows = result.data.rows.length;
  const truncated = totalRows > maxRows;
  const rows = truncated ? result.data.rows.slice(0, maxRows) : result.data.rows;

  return {
    columns: result.data.columns.map((c) => ({ name: c.name, type: c.type })),
    rows,
    total_rows: totalRows,
    returned_rows: rows.length,
    truncated,
    runtime: result.runtime,
    retrieved_at: result.retrieved_at,
  };
}

export function formatJsonResultText(formatted: JsonFormattedResult): string {
  const lines: string[] = [];

  lines.push(`Columns: ${formatted.columns.map((c) => `${c.name} (${c.type})`).join(", ")}`);
  lines.push(`Rows: ${formatted.returned_rows} of ${formatted.total_rows}${formatted.truncated ? " (truncated)" : ""}`);
  lines.push(`Runtime: ${formatted.runtime.toFixed(3)}s`);
  lines.push("");
  lines.push(JSON.stringify(formatted.rows));

  return lines.join("\n");
}

export interface CsvSaveResult {
  file_path: string;
  row_count: number;
  preview: string;
  size_bytes: number;
}

export async function saveCsvResult(
  csvData: string,
  outputDir: string,
  queryLabel: string,
): Promise<CsvSaveResult> {
  const dir = resolve(outputDir);
  await mkdir(dir, { recursive: true });

  const ts = new Date().toISOString().replace(/[:]/g, "-").split(".")[0];
  const safeName = queryLabel.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 50);
  const filePath = join(dir, `${safeName}_${ts}.csv`);

  await writeFile(filePath, csvData, "utf-8");

  const lines = csvData.split("\n").filter((l) => l.trim().length > 0);
  const rowCount = Math.max(0, lines.length - 1);
  const preview = lines.slice(0, 6).join("\n");

  return {
    file_path: filePath,
    row_count: rowCount,
    preview,
    size_bytes: Buffer.byteLength(csvData, "utf-8"),
  };
}

export function formatCsvSaveResultText(result: CsvSaveResult): string {
  return [
    `CSV saved to: ${result.file_path}`,
    `Rows: ${result.row_count}`,
    `Size: ${(result.size_bytes / 1024).toFixed(1)} KB`,
    "",
    "Preview (first 5 rows):",
    result.preview,
  ].join("\n");
}
