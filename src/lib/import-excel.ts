import * as XLSX from "xlsx";

export type ColumnMapping = {
  publisher_id?: number;
  publisher_email?: number;
  publisher_public_id?: number;
  date?: number;
  impressions?: number;
  clicks?: number;
  revenue?: number;
};

export interface ParsedRow {
  publisher_id?: string;
  publisher_email?: string;
  publisher_public_id?: string;
  date?: string;
  impressions?: number;
  clicks?: number;
  revenue?: number;
  raw: unknown[];
}

export function parseExcelFile(buffer: ArrayBuffer): unknown[][] {
  const wb = XLSX.read(buffer, { type: "array" });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const data = XLSX.utils.sheet_to_json<unknown[]>(ws, {
    header: 1,
    defval: "",
    raw: false,
  }) as unknown[][];
  return data;
}

export function getHeaders(data: unknown[][]): string[] {
  const first = data[0];
  if (!first || !Array.isArray(first)) return [];
  return first.map((c) => String(c ?? "").trim());
}

export function applyMapping(
  data: unknown[][],
  mapping: ColumnMapping
): ParsedRow[] {
  const headers = data[0];
  const rows: ParsedRow[] = [];
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    if (!Array.isArray(row)) continue;
    const raw = [...row];
    const get = (col: number | undefined): string | undefined => {
      if (col == null || col < 0 || col >= row.length) return undefined;
      const v = row[col];
      if (v == null) return undefined;
      return String(v).trim() || undefined;
    };
    const getNum = (col: number | undefined): number | undefined => {
      const v = get(col);
      if (v == null) return undefined;
      const n = Number(v.replace(/[^0-9.-]/g, ""));
      return Number.isNaN(n) ? undefined : n;
    };
    rows.push({
      publisher_id: get(mapping.publisher_id),
      publisher_email: get(mapping.publisher_email),
      publisher_public_id: get(mapping.publisher_public_id),
      date: get(mapping.date),
      impressions: getNum(mapping.impressions),
      clicks: getNum(mapping.clicks),
      revenue: getNum(mapping.revenue),
      raw,
    });
  }
  return rows;
}

export function parseDate(s: string | undefined): string | null {
  if (!s) return null;
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}
