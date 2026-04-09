import { createClient } from "@/lib/supabase/server";
import { runPublisherEstimate } from "@/lib/run-publisher-estimate";
import { NextResponse } from "next/server";
import {
  distributePublisherTargetRevenue,
  resolvePublisherStatRange,
} from "@/lib/estimates";
import { buildTimeSegments } from "@/lib/time-segments";

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (profile?.role !== "super_admin")
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await request.json();
  const { month, year, start_day, end_day, preserve_first_n_days } = body as {
    month?: number;
    year?: number;
    start_day?: number | null;
    end_day?: number | null;
    preserve_first_n_days?: number | null;
  };
  if (
    typeof month !== "number" ||
    month < 1 ||
    month > 12 ||
    typeof year !== "number"
  ) {
    return NextResponse.json(
      { error: "Invalid month or year" },
      { status: 400 }
    );
  }

  const preserve =
    preserve_first_n_days != null && !Number.isNaN(Number(preserve_first_n_days))
      ? Math.floor(Number(preserve_first_n_days))
      : 0;

  const startDate = `${year}-${String(month).padStart(2, "0")}-01`;
  const endDate = `${year}-${String(month).padStart(2, "0")}-${String(new Date(year, month, 0).getDate()).padStart(2, "0")}`;

  const { data: targets } = await supabase
    .from("publisher_monthly_targets")
    .select("publisher_id, target_revenue")
    .eq("month", month)
    .eq("year", year);

  if (preserve > 0) {
    let insertedTotal = 0;
    for (const t of targets ?? []) {
      const result = await runPublisherEstimate(supabase, {
        publisher_id: t.publisher_id as string,
        month,
        year,
        start_day,
        end_day,
        preserve_first_n_days: preserve,
      });
      if (!result.ok) {
        return NextResponse.json(
          { error: result.error, code: result.code },
          { status: result.status }
        );
      }
      if (result.ok && !result.skipped) {
        insertedTotal += result.inserted_count;
      }
    }
    return NextResponse.json({
      ok: true,
      mode: "partial",
      rows: insertedTotal,
      preserve_first_n_days: preserve,
    });
  }

  const { data: publishersMeta } = await supabase
    .from("publishers")
    .select("id, created_at");

  const createdAtByPublisher = new Map(
    (publishersMeta ?? []).map((p) => [p.id as string, p.created_at as string])
  );

  await supabase
    .from("daily_stats")
    .delete()
    .gte("stat_date", startDate)
    .lte("stat_date", endDate);

  const toInsert: {
    stat_date: string;
    publisher_id: string;
    impressions: number;
    clicks: number;
    revenue: number;
    time_segments: ReturnType<typeof buildTimeSegments>;
  }[] = [];

  for (const t of targets ?? []) {
    const amount = Number(t.target_revenue);
    if (amount <= 0) continue;
    const range = resolvePublisherStatRange(
      createdAtByPublisher.get(t.publisher_id),
      year,
      month,
      start_day,
      end_day
    );
    if (!range) continue;
    const rows = distributePublisherTargetRevenue(
      t.publisher_id,
      amount,
      year,
      month,
      { firstActiveDay: range.first, lastActiveDay: range.last }
    );
    for (const r of rows) {
      const time_segments = buildTimeSegments(
        r.revenue,
        r.impressions,
        r.clicks,
        r.stat_date
      );
      toInsert.push({
        stat_date: r.stat_date,
        publisher_id: r.publisher_id,
        impressions: r.impressions,
        clicks: r.clicks,
        revenue: r.revenue,
        time_segments,
      });
    }
  }

  if (toInsert.length > 0) {
    const { error } = await supabase.from("daily_stats").insert(toInsert);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, mode: "full", rows: toInsert.length });
}
