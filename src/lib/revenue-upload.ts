/**
 * Shared validation + normalization for admin publisher revenue file uploads.
 * Matches behavior of the original upload route (all-or-nothing on any row error).
 */

export type RevenueUploadInputRow = {
  /** ISO date string YYYY-MM-DD (after client/server parsing) */
  date: string | null;
  impressions: number;
  clicks: number;
  revenue: number;
  /** Report ID from the file (publisher `public_id`). */
  report_id?: string | null;
  /** Legacy: old templates used this column name; value may be Report ID or internal UUID. */
  publisher_id?: string | null;
};

export type CleanedDailyRow = {
  stat_date: string;
  impressions: number;
  clicks: number;
  revenue: number;
};

export type RevenueUploadStats = {
  total_input_rows: number;
  valid_row_count_before_dedupe: number;
  unique_day_count: number;
  min_stat_date: string | null;
  max_stat_date: string | null;
};

/** Rolled up from all days in the file (after aggregation). eCPM/CTR/eCPC are not stored in the file. */
export type RevenueUploadDerivedStats = {
  total_impressions: number;
  total_clicks: number;
  total_revenue: number;
  /** Revenue per 1k impressions (USD) */
  ecpm: number | null;
  /** CTR (%): clicks ÷ impressions × 100 */
  ctr_pct: number | null;
  /** Revenue / click (USD) */
  ecpc: number | null;
};

export type DailyPreviewRow = {
  stat_date: string;
  impressions: number;
  clicks: number;
  revenue: number;
  ecpm: number | null;
  ctr_pct: number | null;
  ecpc: number | null;
};

export type ValidatePublisherUploadResult = {
  ok: boolean;
  errors: string[];
  warnings: string[];
  cleanedRows: CleanedDailyRow[];
  stats: RevenueUploadStats;
  /** Present when ok and there is at least one day of data */
  derived: RevenueUploadDerivedStats | null;
  daily_preview: DailyPreviewRow[];
};

export function computeDerivedTotals(rows: CleanedDailyRow[]): RevenueUploadDerivedStats {
  let imp = 0;
  let clk = 0;
  let rev = 0;
  for (const r of rows) {
    imp += r.impressions;
    clk += r.clicks;
    rev += r.revenue;
  }
  return {
    total_impressions: imp,
    total_clicks: clk,
    total_revenue: rev,
    ecpm: imp > 0 ? (rev / imp) * 1000 : null,
    ctr_pct: imp > 0 ? (clk / imp) * 100 : null,
    ecpc: clk > 0 ? rev / clk : null,
  };
}

function enrichDailyRow(r: CleanedDailyRow): DailyPreviewRow {
  const imp = r.impressions;
  const clk = r.clicks;
  const rev = r.revenue;
  return {
    stat_date: r.stat_date,
    impressions: imp,
    clicks: clk,
    revenue: rev,
    ecpm: imp > 0 ? (rev / imp) * 1000 : null,
    ctr_pct: imp > 0 ? (clk / imp) * 100 : null,
    ecpc: clk > 0 ? rev / clk : null,
  };
}

/**
 * Validates rows for a given calendar month/year, aggregates multiple file rows per day
 * (sum impressions, clicks, revenue). If any row fails validation, `ok` is false and
 * `cleanedRows` is empty (all-or-nothing).
 */
function getReportIdFromRow(r: RevenueUploadInputRow): string {
  const v = r.report_id ?? r.publisher_id;
  return v != null ? String(v).trim() : "";
}

function fileReportIdMatchesSelection(
  raw: string,
  expectedReportId: string | null,
  expectedPublisherUuid: string | null
): boolean {
  const t = raw.trim().toLowerCase();
  if (!t) return true;
  if (expectedReportId && t === expectedReportId.trim().toLowerCase()) return true;
  if (expectedPublisherUuid && t === expectedPublisherUuid.trim().toLowerCase())
    return true;
  return false;
}

/**
 * @param expectedReportId — Publisher `public_id` (Report ID) to match the file column
 * @param expectedPublisherUuid — Internal UUID (legacy files sometimes used this in the last column)
 */
export function validatePublisherUploadRows(
  month: number,
  year: number,
  rows: RevenueUploadInputRow[],
  expectedReportId?: string | null,
  expectedPublisherUuid?: string | null
): ValidatePublisherUploadResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const lineRows: CleanedDailyRow[] = [];

  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 0);
  const expReport =
    typeof expectedReportId === "string" && expectedReportId.trim()
      ? expectedReportId.trim()
      : null;
  const expUuid =
    typeof expectedPublisherUuid === "string" && expectedPublisherUuid.trim()
      ? expectedPublisherUuid.trim()
      : null;

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const idx = i + 1;
    if (!r || typeof r.date !== "string" || !r.date) {
      errors.push(`Row ${idx}: missing date`);
      continue;
    }
    const d = new Date(r.date + "T12:00:00");
    if (Number.isNaN(d.getTime())) {
      errors.push(`Row ${idx}: invalid date '${r.date}'`);
      continue;
    }
    if (d < startDate || d > endDate) {
      errors.push(`Row ${idx}: date ${r.date} not in selected month`);
      continue;
    }
    const impressions = Number(r.impressions);
    const clicks = Number(r.clicks);
    const revenue = Number(r.revenue);
    if (impressions < 0 || clicks < 0 || revenue < 0) {
      errors.push(`Row ${idx}: negative impressions, clicks, or revenue`);
      continue;
    }
    const rid = getReportIdFromRow(r);
    if (rid && (expReport || expUuid) && !fileReportIdMatchesSelection(rid, expReport, expUuid)) {
      errors.push(
        `Row ${idx}: Report ID in file does not match the selected publisher`
      );
      continue;
    }
    lineRows.push({
      stat_date: r.date,
      impressions: impressions || 0,
      clicks: clicks || 0,
      revenue: revenue || 0,
    });
  }

  const validLineCount = lineRows.length;

  if (errors.length > 0 || lineRows.length === 0) {
    return {
      ok: false,
      errors,
      warnings: [],
      cleanedRows: [],
      stats: {
        total_input_rows: rows.length,
        valid_row_count_before_dedupe: validLineCount,
        unique_day_count: 0,
        min_stat_date: null,
        max_stat_date: null,
      },
      derived: null,
      daily_preview: [],
    };
  }

  const linesPerDate = new Map<string, number>();
  for (const row of lineRows) {
    linesPerDate.set(row.stat_date, (linesPerDate.get(row.stat_date) ?? 0) + 1);
  }
  for (const [sd, count] of linesPerDate) {
    if (count > 1) {
      warnings.push(
        `Date ${sd}: ${count} rows in file — impressions, clicks, and revenue are summed for that day.`
      );
    }
  }

  const byDate = new Map<string, CleanedDailyRow>();
  for (const row of lineRows) {
    const prev = byDate.get(row.stat_date);
    if (!prev) {
      byDate.set(row.stat_date, { ...row });
    } else {
      byDate.set(row.stat_date, {
        stat_date: row.stat_date,
        impressions: prev.impressions + row.impressions,
        clicks: prev.clicks + row.clicks,
        revenue: prev.revenue + row.revenue,
      });
    }
  }
  const deduped = Array.from(byDate.values()).sort((a, b) =>
    a.stat_date.localeCompare(b.stat_date)
  );

  const dates = deduped.map((r) => r.stat_date);
  const min_stat_date = dates[0] ?? null;
  const max_stat_date = dates[dates.length - 1] ?? null;

  const derived = computeDerivedTotals(deduped);
  const daily_preview = deduped.map(enrichDailyRow);

  return {
    ok: true,
    errors: [],
    warnings,
    cleanedRows: deduped,
    stats: {
      total_input_rows: rows.length,
      valid_row_count_before_dedupe: validLineCount,
      unique_day_count: deduped.length,
      min_stat_date,
      max_stat_date,
    },
    derived,
    daily_preview,
  };
}
