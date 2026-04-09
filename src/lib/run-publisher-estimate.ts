import type { SupabaseClient } from "@supabase/supabase-js";
import {
  computePartialPreservePlan,
  getFrozenPrefixStatBounds,
} from "@/lib/estimate-partial";
import {
  distributePublisherTargetRevenue,
  resolvePublisherStatRange,
} from "@/lib/estimates";
import { buildTimeSegments } from "@/lib/time-segments";

export type RunPublisherEstimateParams = {
  publisher_id: string;
  month: number;
  year: number;
  start_day?: number | null;
  end_day?: number | null;
  /** If > 0, only replace stats after first N calendar days (see plan). */
  preserve_first_n_days?: number | null;
};

export type RunPublisherEstimateSuccess = {
  ok: true;
  skipped: boolean;
  reason?: string;
  inserted_count: number;
  mode: "full" | "partial";
  frozen_sum?: number;
  remaining?: number;
  tail_start_day?: number;
  tail_end_day?: number;
};

export type RunPublisherEstimateFailure = {
  ok: false;
  status: number;
  error: string;
  code?: string;
};

function monthEndDate(year: number, month: number): string {
  const d = new Date(year, month, 0).getDate();
  return `${year}-${String(month).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

function monthStartDate(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, "0")}-01`;
}

/**
 * Generate or partially regenerate estimated daily_stats for one publisher/month.
 */
export async function runPublisherEstimate(
  supabase: SupabaseClient,
  params: RunPublisherEstimateParams
): Promise<RunPublisherEstimateSuccess | RunPublisherEstimateFailure> {
  const { publisher_id, month, year, start_day, end_day } = params;
  const preserveRaw = params.preserve_first_n_days;
  const preserve =
    preserveRaw != null && !Number.isNaN(Number(preserveRaw))
      ? Math.floor(Number(preserveRaw))
      : 0;

  const startDate = monthStartDate(year, month);
  const endDate = monthEndDate(year, month);

  const { data: target } = await supabase
    .from("publisher_monthly_targets")
    .select("target_revenue")
    .eq("publisher_id", publisher_id)
    .eq("month", month)
    .eq("year", year)
    .maybeSingle();

  const amount = target ? Number(target.target_revenue) : 0;
  if (!target || amount <= 0) {
    return {
      ok: true,
      skipped: true,
      reason: "no_target",
      inserted_count: 0,
      mode: preserve > 0 ? "partial" : "full",
    };
  }

  const { data: pub } = await supabase
    .from("publishers")
    .select("created_at")
    .eq("id", publisher_id)
    .maybeSingle();

  const createdAt = pub?.created_at as string | undefined;

  if (preserve > 0) {
    console.log("[runPublisherEstimate] partial", {
      publisher_id: `${publisher_id.slice(0, 8)}…`,
      month,
      year,
      preserve_first_n_days: preserve,
    });
    const bounds = getFrozenPrefixStatBounds(year, month, createdAt, preserve);
    if (!bounds.ok) {
      return { ok: false, status: 400, error: bounds.error, code: bounds.code };
    }

    const { frozenStartStatDate, frozenEndStatDate } = bounds;

    const { data: frozenRows, error: frozenErr } = await supabase
      .from("daily_stats")
      .select("revenue")
      .eq("publisher_id", publisher_id)
      .gte("stat_date", frozenStartStatDate)
      .lte("stat_date", frozenEndStatDate);

    if (frozenErr) {
      return { ok: false, status: 500, error: frozenErr.message };
    }

    if (!frozenRows?.length) {
      return {
        ok: false,
        status: 400,
        error:
          "No existing daily stats in the frozen period. Generate a full month first, then regenerate with preserve.",
        code: "no_frozen_rows",
      };
    }

    const frozenSum = (frozenRows ?? []).reduce(
      (s, row) => s + Number((row as { revenue: unknown }).revenue ?? 0),
      0
    );

    const plan = computePartialPreservePlan({
      monthlyTarget: amount,
      preserveFirstNDays: preserve,
      year,
      month,
      publisherCreatedAt: createdAt,
      frozenSum,
    });

    if (!plan.ok) {
      return { ok: false, status: 400, error: plan.error, code: plan.code };
    }

    console.log("[runPublisherEstimate] partial plan", {
      frozenSum: plan.frozenSum,
      remaining: plan.remaining,
      tailStartDay: plan.tailStartDay,
      tailEndDay: plan.tailEndDay,
      monthlyTarget: amount,
    });

    const { error: delErr } = await supabase
      .from("daily_stats")
      .delete()
      .eq("publisher_id", publisher_id)
      .gt("stat_date", plan.frozenEndStatDate)
      .lte("stat_date", endDate);

    if (delErr) {
      return { ok: false, status: 500, error: delErr.message };
    }

    if (plan.tailStartDay > plan.tailEndDay || plan.remaining <= 0) {
      return {
        ok: true,
        skipped: false,
        inserted_count: 0,
        mode: "partial",
        frozen_sum: plan.frozenSum,
        remaining: plan.remaining,
        tail_start_day: plan.tailStartDay,
        tail_end_day: plan.tailEndDay,
      };
    }

    const rows = distributePublisherTargetRevenue(
      publisher_id,
      plan.remaining,
      year,
      month,
      { firstActiveDay: plan.tailStartDay, lastActiveDay: plan.tailEndDay }
    );

    const toInsert = rows.map((r) => {
      const time_segments = buildTimeSegments(
        r.revenue,
        r.impressions,
        r.clicks,
        r.stat_date
      );
      return {
        stat_date: r.stat_date,
        publisher_id: r.publisher_id,
        impressions: r.impressions,
        clicks: r.clicks,
        revenue: r.revenue,
        time_segments,
      };
    });

    if (toInsert.length > 0) {
      const { error: insErr } = await supabase.from("daily_stats").insert(toInsert);
      if (insErr) {
        return { ok: false, status: 500, error: insErr.message };
      }
    }

    return {
      ok: true,
      skipped: false,
      inserted_count: toInsert.length,
      mode: "partial",
      frozen_sum: plan.frozenSum,
      remaining: plan.remaining,
      tail_start_day: plan.tailStartDay,
      tail_end_day: plan.tailEndDay,
    };
  }

  // Full month replace (existing behavior)
  const range = resolvePublisherStatRange(createdAt, year, month, start_day, end_day);

  await supabase
    .from("daily_stats")
    .delete()
    .eq("publisher_id", publisher_id)
    .gte("stat_date", startDate)
    .lte("stat_date", endDate);

  if (!range) {
    return {
      ok: true,
      skipped: true,
      reason: "publisher_not_active_this_month",
      inserted_count: 0,
      mode: "full",
    };
  }

  const rows = distributePublisherTargetRevenue(publisher_id, amount, year, month, {
    firstActiveDay: range.first,
    lastActiveDay: range.last,
  });

  const toInsert = rows.map((r) => {
    const time_segments = buildTimeSegments(
      r.revenue,
      r.impressions,
      r.clicks,
      r.stat_date
    );
    return {
      stat_date: r.stat_date,
      publisher_id: r.publisher_id,
      impressions: r.impressions,
      clicks: r.clicks,
      revenue: r.revenue,
      time_segments,
    };
  });

  if (toInsert.length > 0) {
    const { error } = await supabase.from("daily_stats").insert(toInsert);
    if (error) {
      return { ok: false, status: 500, error: error.message };
    }
  }

  return {
    ok: true,
    skipped: false,
    inserted_count: toInsert.length,
    mode: "full",
  };
}
