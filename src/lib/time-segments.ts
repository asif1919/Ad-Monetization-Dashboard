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
  time_segments?: TimeSegment[] | null;
};

/**
 * Returns effective revenue, impressions, clicks to display for a row.
 * If the row has time_segments and stat_date is "today" (in UTC), returns the sum
 * of segments that have ended by `now`; otherwise returns full-day totals.
 */
export function getEffectiveStatsAtTime(
  row: RowWithSegments,
  now: Date
): { revenue: number; impressions: number; clicks: number } {
  const segments = row.time_segments;
  if (!segments || segments.length === 0)
    return {
      revenue: Number(row.revenue) || 0,
      impressions: Number(row.impressions) || 0,
      clicks: Number(row.clicks) || 0,
    };

  const todayUtc = now.toISOString().slice(0, 10);
  if (row.stat_date !== todayUtc)
    return {
      revenue: Number(row.revenue) || 0,
      impressions: Number(row.impressions) || 0,
      clicks: Number(row.clicks) || 0,
    };

  const nowMinutes = now.getUTCHours() * 60 + now.getUTCMinutes();

  let revenue = 0,
    impressions = 0,
    clicks = 0;
  for (const seg of segments) {
    if (timeToMinutes(seg.end) <= nowMinutes) {
      revenue += Number(seg.revenue) || 0;
      impressions += Number(seg.impressions) || 0;
      clicks += Number(seg.clicks) || 0;
    }
  }
  return { revenue, impressions, clicks };
}

function timeToMinutes(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}
