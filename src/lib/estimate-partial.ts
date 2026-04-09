import { resolvePublisherStatRange } from "@/lib/estimates";

/**
 * Calendar bounds for "preserve first N days" (intersected with publisher active range).
 * Used before loading frozen sum from DB.
 */
export function getFrozenPrefixStatBounds(
  year: number,
  month: number,
  publisherCreatedAt: string | null | undefined,
  preserveFirstNDays: number
):
  | {
      ok: true;
      frozenStartDay: number;
      frozenEndDay: number;
      frozenStartStatDate: string;
      frozenEndStatDate: string;
      tailStartDay: number;
      tailEndDay: number;
    }
  | { ok: false; error: string; code: string } {
  const daysInMonth = new Date(year, month, 0).getDate();
  const n = Math.floor(Number(preserveFirstNDays));
  if (!Number.isFinite(n) || n < 1) {
    return { ok: false, error: "preserve_first_n_days must be a positive integer", code: "invalid_preserve" };
  }
  if (n > daysInMonth) {
    return {
      ok: false,
      error: `preserve_first_n_days cannot exceed days in month (${daysInMonth})`,
      code: "invalid_preserve",
    };
  }

  const range = resolvePublisherStatRange(
    publisherCreatedAt,
    year,
    month,
    null,
    null
  );
  if (!range) {
    return { ok: false, error: "Publisher has no active days in this month", code: "no_active_range" };
  }

  const frozenEndDay = Math.min(n, range.last, daysInMonth);
  const frozenStartDay = range.first;

  if (frozenStartDay > frozenEndDay) {
    return {
      ok: false,
      error: "Cannot preserve: publisher is not active in the first N days of this month",
      code: "no_overlap_frozen",
    };
  }

  const pad = (d: number) => String(d).padStart(2, "0");
  const frozenStartStatDate = `${year}-${String(month).padStart(2, "0")}-${pad(frozenStartDay)}`;
  const frozenEndStatDate = `${year}-${String(month).padStart(2, "0")}-${pad(frozenEndDay)}`;

  const tailStartDay = frozenEndDay + 1;
  const tailEndDay = range.last;

  return {
    ok: true,
    frozenStartDay,
    frozenEndDay,
    frozenStartStatDate,
    frozenEndStatDate,
    tailStartDay,
    tailEndDay,
  };
}

export type PartialPreserveOk = {
  ok: true;
  /** Sum of revenue in frozen window (caller loads from DB). */
  frozenSum: number;
  /** Monthly target minus frozen sum; spread across tail. */
  remaining: number;
  /** Inclusive calendar day of month where tail generation starts. */
  tailStartDay: number;
  /** Inclusive calendar day of month where tail ends. */
  tailEndDay: number;
  /** Inclusive calendar end day of frozen prefix (min(N, range.last)). */
  freezeEndDay: number;
  /** ISO stat_date string for frozen range lower bound (for queries). */
  frozenStartStatDate: string;
  /** ISO stat_date string for frozen range upper bound. */
  frozenEndStatDate: string;
};

export type PartialPreserveResult =
  | PartialPreserveOk
  | { ok: false; error: string; code: string };

/**
 * Validates partial regeneration (preserve first N calendar days) and computes tail bounds.
 * `monthlyTarget` is T; `frozenSum` must be loaded by the caller from daily_stats in the frozen window.
 */
export function computePartialPreservePlan(params: {
  monthlyTarget: number;
  preserveFirstNDays: number;
  year: number;
  month: number;
  publisherCreatedAt: string | null | undefined;
  /** Pre-computed sum of revenue for stat_date in [frozenStartStatDate, frozenEndStatDate]. */
  frozenSum: number;
}): PartialPreserveResult {
  const { monthlyTarget, preserveFirstNDays, year, month, publisherCreatedAt, frozenSum } =
    params;

  const bounds = getFrozenPrefixStatBounds(year, month, publisherCreatedAt, preserveFirstNDays);
  if (!bounds.ok) return bounds;

  const {
    frozenEndDay: freezeEndDay,
    frozenStartStatDate,
    frozenEndStatDate,
    tailStartDay,
    tailEndDay,
  } = bounds;

  if (monthlyTarget < frozenSum - 1e-6) {
    return {
      ok: false,
      error: `Monthly target (${monthlyTarget}) is less than revenue already in the frozen period (${frozenSum.toFixed(2)}). Raise the target or reduce preserved days.`,
      code: "target_below_frozen",
    };
  }

  const remaining = Math.max(0, monthlyTarget - frozenSum);

  if (tailStartDay > tailEndDay && remaining > 1e-6) {
    return {
      ok: false,
      error:
        "No remaining days in the month to allocate the surplus. Shorten the preserved window or raise the target.",
      code: "no_tail",
    };
  }

  return {
    ok: true,
    frozenSum,
    remaining,
    tailStartDay,
    tailEndDay,
    freezeEndDay,
    frozenStartStatDate,
    frozenEndStatDate,
  };
}
