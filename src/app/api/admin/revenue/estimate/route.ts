import { createClient } from "@/lib/supabase/server";
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
  const { month, year, start_day, end_day } = body as {
    month?: number;
    year?: number;
    /** Applied per publisher with join-date rules (see resolvePublisherStatRange) */
    start_day?: number | null;
    end_day?: number | null;
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

  const startDate = `${year}-${String(month).padStart(2, "0")}-01`;
  const endDate = `${year}-${String(month).padStart(2, "0")}-${String(new Date(year, month, 0).getDate()).padStart(2, "0")}`;

  const daysInMonth = new Date(year, month, 0).getDate();

  const { data: targets } = await supabase
    .from("publisher_monthly_targets")
    .select("publisher_id, target_revenue")
    .eq("month", month)
    .eq("year", year);

  const { data: publishersMeta } = await supabase
    .from("publishers")
    .select("id, created_at");

  const createdAtByPublisher = new Map(
    (publishersMeta ?? []).map((p) => [p.id as string, p.created_at as string])
  );

  // Find publishers that already have real data for this month so we don't
  // overwrite them with new estimates.
  const { data: realStats } = await supabase
    .from("daily_stats")
    .select("publisher_id")
    .gte("stat_date", startDate)
    .lte("stat_date", endDate)
    .eq("is_estimated", false);

  const publishersWithRealData = new Set(
    (realStats ?? []).map((r: any) => r.publisher_id as string)
  );

  await supabase
    .from("daily_stats")
    .delete()
    .gte("stat_date", startDate)
    .lte("stat_date", endDate)
    .eq("is_estimated", true);

  const toInsert: {
    stat_date: string;
    publisher_id: string;
    impressions: number;
    clicks: number;
    revenue: number;
    is_estimated: boolean;
    time_segments: ReturnType<typeof buildTimeSegments>;
  }[] = [];

  for (const t of targets ?? []) {
    const amount = Number(t.target_revenue);
    if (amount <= 0) continue;
    if (publishersWithRealData.has(t.publisher_id)) continue;
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
        is_estimated: true,
        time_segments,
      });
    }
  }

  if (toInsert.length > 0) {
    const { error } = await supabase.from("daily_stats").insert(toInsert);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, rows: toInsert.length });
}
