import type { TimeSegment } from "@/lib/supabase/types";

/**
 * Segment times are stored and compared in UTC (HH:mm).
 * "Today" and "current time" use the same clock (server UTC) for consistency.
 */

const MINUTES_PER_DAY = 24 * 60;
const SEGMENT_COUNT = 30;
const MIN_SEGMENT_MINUTES = 20;
const MAX_SEGMENT_MINUTES = 80;

/** Simple numeric hash of a string for deterministic "random" variation. */
function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h * 31 + s.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

/** Minutes since midnight (0..1439) to "HH:mm" string. */
function minutesToTime(m: number): string {
  const h = Math.floor(m / 60) % 24;
  const min = m % 60;
  return `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
}

/**
 * Build ~30 irregular time segments for one day that sum to the given totals.
 * Intervals have irregular lengths (e.g. 20–80 min) and natural-looking times.
 * Distribution of revenue/impressions/clicks across segments is non-uniform.
 */
export function buildTimeSegments(
  revenue: number,
  impressions: number,
  clicks: number,
  statDate: string
): TimeSegment[] {
  const seed = hash(statDate);
  const intervals: { start: string; end: string; weight: number }[] = [];
  let cursor = 0;

  for (let i = 0; i < SEGMENT_COUNT && cursor < MINUTES_PER_DAY; i++) {
    const span =
      MIN_SEGMENT_MINUTES +
      ((seed + i * 7919) % (MAX_SEGMENT_MINUTES - MIN_SEGMENT_MINUTES + 1));
    const endMinutes = Math.min(cursor + span, MINUTES_PER_DAY);
    const startStr = minutesToTime(cursor);
    const endStr = minutesToTime(endMinutes);
    cursor = endMinutes;
    const weight =
      0.3 +
      0.7 * (((seed + i * 31) % 1000) / 1000) * (i % 3 === 0 ? 1.2 : 1);
    intervals.push({ start: startStr, end: endStr, weight });
  }

  const totalWeight = intervals.reduce((s, t) => s + t.weight, 0);
  const segments: TimeSegment[] = [];
  let accR = 0,
    accI = 0,
    accC = 0;
  for (let i = 0; i < intervals.length; i++) {
    const w = intervals[i].weight / totalWeight;
    const segR =
      i === intervals.length - 1 ? revenue - accR : revenue * w;
    const segI =
      i === intervals.length - 1
        ? impressions - accI
        : Math.round(impressions * w);
    const segC =
      i === intervals.length - 1 ? clicks - accC : Math.round(clicks * w);
    accR += segR;
    accI += segI;
    accC += segC;
    segments.push({
      start: intervals[i].start,
      end: intervals[i].end,
      revenue: segR,
      impressions: segI,
      clicks: segC,
    });
  }
  return segments;
}

export type RowWithSegments = {
  stat_date: string;
  revenue: number;
  impressions: number;
  clicks: number;
  time_segments?: TimeSegment[] | string | Record<string, unknown> | null;
};

function isTimeSegmentLike(x: unknown): x is TimeSegment {
  return (
    typeof x === "object" &&
    x !== null &&
    "start" in x &&
    "end" in x &&
    typeof (x as TimeSegment).start === "string" &&
    typeof (x as TimeSegment).end === "string"
  );
}

/** If JSONB was stored or deserialized as an object (numeric keys / wrapper), coerce to array. */
function coerceObjectToSegments(raw: Record<string, unknown>): TimeSegment[] | null {
  if (Array.isArray(raw.segments)) {
    return parseSegments(raw.segments as TimeSegment[] | string | null);
  }
  const numericKeys = Object.keys(raw).filter((k) => /^\d+$/.test(k));
  if (numericKeys.length > 0) {
    const sorted = numericKeys.sort((a, b) => Number(a) - Number(b));
    const vals = sorted.map((k) => raw[k]);
    if (vals.every(isTimeSegmentLike)) return vals as TimeSegment[];
  }
  const vals = Object.values(raw);
  if (vals.length > 0 && vals.every(isTimeSegmentLike)) return vals as TimeSegment[];
  return null;
}

/** Normalize time_segments from DB (may be JSON string or double-stringified) to TimeSegment[]. */
function parseSegments(
  raw: TimeSegment[] | string | Record<string, unknown> | null | undefined
): TimeSegment[] | null {
  if (raw == null) return null;
  if (Array.isArray(raw)) return raw;
  if (typeof raw === "object" && raw !== null) {
    return coerceObjectToSegments(raw as Record<string, unknown>);
  }
  if (typeof raw !== "string") return null;
  try {
    let parsed = JSON.parse(raw) as unknown;
    // DB sometimes returns double-stringified JSON: "[{\"end\":\"01:14\"...}]"
    if (typeof parsed === "string") {
      parsed = JSON.parse(parsed) as unknown;
    }
    if (Array.isArray(parsed)) return parsed as TimeSegment[];
    if (typeof parsed === "object" && parsed !== null) {
      return coerceObjectToSegments(parsed as Record<string, unknown>);
    }
    return null;
  } catch {
    return null;
  }
}

const LOG_PROGRESSIVE = process.env.NODE_ENV !== "production" || process.env.LOG_PROGRESSIVE === "1";

/**
 * Returns effective revenue, impressions, clicks to display for a row.
 * If the row has time_segments and stat_date is "today" (in UTC), returns the sum
 * of segments that have ended by `now`; otherwise returns full-day totals.
 */
export function getEffectiveStatsAtTime(
  row: RowWithSegments,
  now: Date,
  todayOverride?: string
): { revenue: number; impressions: number; clicks: number; hadError?: boolean } {
  const todayUtc = todayOverride ?? now.toISOString().slice(0, 10);
  const isToday = row.stat_date === todayUtc;

  let segments = parseSegments(row.time_segments);
  // Real/imported rows often have no time_segments; estimated rows usually do. Synthesize
  // from row totals so "today" stays progressive instead of 0 or noisy errors.
  if (!segments || segments.length === 0) {
    if (isToday) {
      segments = buildTimeSegments(
        Number(row.revenue) || 0,
        Number(row.impressions) || 0,
        Number(row.clicks) || 0,
        row.stat_date
      );
    }
  }
  if (!segments || segments.length === 0) {
    if (LOG_PROGRESSIVE) {
      console.log("[getEffectiveStatsAtTime] full-day (no segments, not today)", {
        stat_date: row.stat_date,
        todayOverride,
        rawType: typeof row.time_segments,
        rawIsArray: Array.isArray(row.time_segments),
      });
    }
    return {
      revenue: Number(row.revenue) || 0,
      impressions: Number(row.impressions) || 0,
      clicks: Number(row.clicks) || 0,
    };
  }

  if (!isToday) {
    if (LOG_PROGRESSIVE) {
      console.log("[getEffectiveStatsAtTime] full-day (not today)", {
        stat_date: row.stat_date,
        todayUtc,
      });
    }
    return {
      revenue: Number(row.revenue) || 0,
      impressions: Number(row.impressions) || 0,
      clicks: Number(row.clicks) || 0,
    };
  }

  // Progressive cutoff only when the current UTC date equals the selected day.
  // Otherwise: future day → 0; past day → full-day totals.
  const nowDateStr = now.toISOString().slice(0, 10);
  if (nowDateStr < todayUtc) {
    if (LOG_PROGRESSIVE) {
      console.log("[getEffectiveStatsAtTime] zero (selected day is in future)", {
        stat_date: row.stat_date,
        nowDateStr,
        todayUtc,
      });
    }
    return { revenue: 0, impressions: 0, clicks: 0 };
  }
  if (nowDateStr > todayUtc) {
    if (LOG_PROGRESSIVE) {
      console.log("[getEffectiveStatsAtTime] full-day (selected day is in past)", {
        stat_date: row.stat_date,
        nowDateStr,
        todayUtc,
      });
    }
    return {
      revenue: Number(row.revenue) || 0,
      impressions: Number(row.impressions) || 0,
      clicks: Number(row.clicks) || 0,
    };
  }

  const nowMinutes = now.getUTCHours() * 60 + now.getUTCMinutes();
  let revenue = 0,
    impressions = 0,
    clicks = 0;
  let included = 0;
  for (const seg of segments) {
    if (timeToMinutes(seg.end) <= nowMinutes) {
      revenue += Number(seg.revenue) || 0;
      impressions += Number(seg.impressions) || 0;
      clicks += Number(seg.clicks) || 0;
      included++;
    }
  }

  if (LOG_PROGRESSIVE) {
    console.log("[getEffectiveStatsAtTime] progressive", {
      stat_date: row.stat_date,
      todayOverride,
      nowUtc: now.toISOString().slice(0, 16),
      nowMinutes,
      segmentsTotal: segments.length,
      segmentsIncluded: included,
      fullDayRevenue: Number(row.revenue) || 0,
      effectiveRevenue: revenue,
      fullDayImpressions: Number(row.impressions) || 0,
      effectiveImpressions: impressions,
    });
  }

  return { revenue, impressions, clicks };
}

function timeToMinutes(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

/** Format local date as YYYY-MM-DD (user's timezone). */
function localDateString(now: Date): string {
  const y = now.getFullYear();
  const m = now.getMonth() + 1;
  const d = now.getDate();
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

/**
 * Same as getEffectiveStatsAtTime but uses the user's LOCAL date and time.
 * Use this in the browser so "3 AM" means 3 AM in the user's timezone.
 * - If selected date is in the future (local) → 0.
 * - If selected date is in the past (local) → full-day totals.
 * - If selected date is today (local) → sum of segments with end <= current local time.
 */
export function getEffectiveStatsAtTimeLocal(
  row: RowWithSegments,
  now: Date,
  selectedDate: string
): { revenue: number; impressions: number; clicks: number; hadError?: boolean } {
  const localDateStr = localDateString(now);
  const isSelectedDay = row.stat_date === selectedDate;

  let segments = parseSegments(row.time_segments);
  if (!segments || segments.length === 0) {
    if (isSelectedDay && localDateStr === selectedDate) {
      segments = buildTimeSegments(
        Number(row.revenue) || 0,
        Number(row.impressions) || 0,
        Number(row.clicks) || 0,
        row.stat_date
      );
    }
  }

  if (!segments || segments.length === 0) {
    if (isSelectedDay) {
      if (localDateStr > selectedDate) {
        return {
          revenue: Number(row.revenue) || 0,
          impressions: Number(row.impressions) || 0,
          clicks: Number(row.clicks) || 0,
        };
      }
      return { revenue: 0, impressions: 0, clicks: 0, hadError: true };
    }
    return {
      revenue: Number(row.revenue) || 0,
      impressions: Number(row.impressions) || 0,
      clicks: Number(row.clicks) || 0,
    };
  }

  if (!isSelectedDay) {
    return {
      revenue: Number(row.revenue) || 0,
      impressions: Number(row.impressions) || 0,
      clicks: Number(row.clicks) || 0,
    };
  }

  if (localDateStr < selectedDate) {
    return { revenue: 0, impressions: 0, clicks: 0 };
  }
  if (localDateStr > selectedDate) {
    return {
      revenue: Number(row.revenue) || 0,
      impressions: Number(row.impressions) || 0,
      clicks: Number(row.clicks) || 0,
    };
  }

  const localMinutes = now.getHours() * 60 + now.getMinutes();
  let revenue = 0,
    impressions = 0,
    clicks = 0;
  for (const seg of segments) {
    if (timeToMinutes(seg.end) <= localMinutes) {
      revenue += Number(seg.revenue) || 0;
      impressions += Number(seg.impressions) || 0;
      clicks += Number(seg.clicks) || 0;
    }
  }
  return { revenue, impressions, clicks };
}
