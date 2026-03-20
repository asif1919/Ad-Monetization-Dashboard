import * as XLSX from "xlsx";
import type { RevenueUploadInputRow } from "@/lib/revenue-upload";

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

/** Normalize header for matching: trim, lower, collapse spaces. */
function normalizeHeaderKey(h: string): string {
  return h.trim().toLowerCase().replace(/\s+/g, " ");
}

/**
 * Parse dates like 17/03/2026 (DD/MM/YYYY), DD-MM-YYYY, or ISO / Excel text dates.
 * Returns YYYY-MM-DD or null.
 */
export function parseReportDateFlexible(raw: string | undefined): string | null {
  if (raw == null) return null;
  const s = String(raw).trim();
  if (!s) return null;

  const slash = s.match(
    /^(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{2,4})(?:\s+(\d{1,2}:\d{2}(?::\d{2})?)?)?$/
  );
  if (slash) {
    const day = parseInt(slash[1], 10);
    const month = parseInt(slash[2], 10);
    let year = parseInt(slash[3], 10);
    if (year < 100) year += year < 50 ? 2000 : 1900;
    if (month < 1 || month > 12 || day < 1 || day > 31) return null;
    const d = new Date(year, month - 1, day);
    if (Number.isNaN(d.getTime())) return null;
    if (d.getFullYear() !== year || d.getMonth() !== month - 1 || d.getDate() !== day)
      return null;
    return d.toISOString().slice(0, 10);
  }

  return parseDate(s);
}

function parseNumericCell(raw: string | undefined): number {
  if (raw == null) return 0;
  const s = String(raw).trim();
  if (!s) return 0;
  const n = Number(s.replace(/[^0-9.-]/g, ""));
  return Number.isNaN(n) ? 0 : n;
}

function findColumnIndex(headers: string[], ...candidates: string[]): number | undefined {
  const nhs = headers.map(normalizeHeaderKey);
  for (const cand of candidates) {
    const t = normalizeHeaderKey(cand);
    const i = nhs.findIndex((h) => h === t);
    if (i >= 0) return i;
  }
  const strip = (x: string) => x.replace(/[()]/g, "");
  for (const cand of candidates) {
    const t = strip(normalizeHeaderKey(cand));
    const i = nhs.findIndex((h) => strip(h) === t);
    if (i >= 0) return i;
  }
  return undefined;
}

function rowIsEffectivelyEmpty(row: unknown[]): boolean {
  return row.every((c) => {
    if (c == null) return true;
    const s = String(c).trim();
    return s === "";
  });
}

/** Preferred export report layout (header names). */
export const PUBLISHER_REPORT_HEADER_NAMES = [
  "URL",
  "Date",
  "Ad Format",
  "Device",
  "Impressions",
  "Click",
  "eCPM",
  "CTR Rate",
  "Net revenue (USD)",
  "Report ID",
] as const;

function pushRowFromIndices(
  rows: RevenueUploadInputRow[],
  row: unknown[],
  dateIdx: number,
  impIdx: number,
  clickIdx: number,
  revIdx: number,
  pubIdx: number | undefined
) {
  const rawDate = row[dateIdx] != null ? String(row[dateIdx]).trim() : "";
  const iso = parseReportDateFlexible(rawDate);
  const reportId =
    pubIdx !== undefined && row[pubIdx] != null
      ? String(row[pubIdx]).trim() || null
      : null;
  rows.push({
    date: iso,
    impressions: parseNumericCell(row[impIdx] != null ? String(row[impIdx]) : undefined),
    clicks: parseNumericCell(row[clickIdx] != null ? String(row[clickIdx]) : undefined),
    revenue: parseNumericCell(row[revIdx] != null ? String(row[revIdx]) : undefined),
    report_id: reportId,
  });
}

/**
 * Parse first sheet: row 1 = headers. Supports named columns, fixed 10-column order
 * (URL…Report ID), or legacy A–D (Date, Impressions, Clicks, Revenue).
 */
export function parsePublisherRevenueReportRows(data: unknown[][]): {
  rows: RevenueUploadInputRow[];
  error: string | null;
} {
  if (!data || data.length < 2) {
    return { rows: [], error: "File appears to be empty or has no data rows." };
  }

  const headers = getHeaders(data);
  const dateIdx = findColumnIndex(headers, "Date", "date");
  const impIdx = findColumnIndex(headers, "Impressions", "impressions");
  const clickIdx = findColumnIndex(headers, "Click", "Clicks", "click", "clicks");
  const revIdx = findColumnIndex(
    headers,
    "Net revenue (USD)",
    "Net revenue",
    "net revenue (usd)",
    "Revenue",
    "revenue"
  );
  const pubIdx = findColumnIndex(
    headers,
    "Report ID",
    "report id",
    "publisher_id",
    "Publisher ID",
    "publisher id"
  );

  const looksLikeNewFormat =
    dateIdx !== undefined &&
    impIdx !== undefined &&
    clickIdx !== undefined &&
    revIdx !== undefined;

  if (looksLikeNewFormat) {
    const rows: RevenueUploadInputRow[] = [];
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      if (!Array.isArray(row)) continue;
      if (rowIsEffectivelyEmpty(row)) continue;
      pushRowFromIndices(rows, row, dateIdx, impIdx, clickIdx, revIdx, pubIdx);
    }
    return { rows, error: null };
  }

  /** Fixed order: URL, Date, Ad Format, Device, Impressions, Click, eCPM, CTR Rate, Net revenue (USD), Report ID */
  const col0 = normalizeHeaderKey(headers[0] ?? "");
  const col1 = normalizeHeaderKey(headers[1] ?? "");
  const looksLikeStandardTenCol =
    headers.length >= 10 &&
    (col0 === "url" || col1 === "date" || col1.includes("date"));
  if (looksLikeStandardTenCol) {
    const rows: RevenueUploadInputRow[] = [];
    const DI = 1;
    const II = 4;
    const CI = 5;
    const RI = 8;
    const PI = 9;
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      if (!Array.isArray(row)) continue;
      if (rowIsEffectivelyEmpty(row)) continue;
      pushRowFromIndices(rows, row, DI, II, CI, RI, PI);
    }
    return { rows, error: null };
  }

  // Legacy: row 1 = header; columns A–D = Date, Impressions, Clicks, Revenue
  const rows: RevenueUploadInputRow[] = [];
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    if (!Array.isArray(row)) continue;
    if (rowIsEffectivelyEmpty(row)) continue;
    const rawDate = (row[0] ?? "") as string;
    rows.push({
      date: parseReportDateFlexible(String(rawDate)),
      impressions: parseNumericCell(row[1] != null ? String(row[1]) : undefined),
      clicks: parseNumericCell(row[2] != null ? String(row[2]) : undefined),
      revenue: parseNumericCell(row[3] != null ? String(row[3]) : undefined),
    });
  }

  if (rows.length === 0) {
    return {
      rows: [],
      error:
        "Could not find required columns. Use the template: Date, Impressions, Click, Net revenue (USD) in row 1 (or the full 10-column layout).",
    };
  }

  return { rows, error: null };
}
