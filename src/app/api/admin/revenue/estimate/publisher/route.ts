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
  const { publisher_id, month, year, start_day, end_day } = body as {
    publisher_id?: string;
    month?: number;
    year?: number;
    /** Optional inclusive day-of-month overrides (1–31) */
    start_day?: number | null;
    end_day?: number | null;
  };
  if (
    !publisher_id ||
    typeof publisher_id !== "string" ||
    typeof month !== "number" ||
    month < 1 ||
    month > 12 ||
    typeof year !== "number"
  ) {
    return NextResponse.json(
      { error: "publisher_id, month, and year are required" },
      { status: 400 }
    );
  }

  const startDate = `${year}-${String(month).padStart(2, "0")}-01`;
  const endDate = `${year}-${String(month).padStart(
    2,
    "0"
  )}-${String(new Date(year, month, 0).getDate()).padStart(2, "0")}`;

  const { data: target } = await supabase
    .from("publisher_monthly_targets")
    .select("target_revenue")
    .eq("publisher_id", publisher_id)
    .eq("month", month)
    .eq("year", year)
    .maybeSingle();

  const amount = target ? Number(target.target_revenue) : 0;
  if (!target || amount <= 0) {
    return NextResponse.json({
      skipped: true,
      reason: "no_target",
    });
  }

  const { data: pub } = await supabase
    .from("publishers")
    .select("created_at")
    .eq("id", publisher_id)
    .maybeSingle();

  const daysInMonth = new Date(year, month, 0).getDate();
  const range = resolvePublisherStatRange(
    pub?.created_at as string | undefined,
    year,
    month,
    start_day,
    end_day
  );

  await supabase
    .from("daily_stats")
    .delete()
    .eq("publisher_id", publisher_id)
    .gte("stat_date", startDate)
    .lte("stat_date", endDate);

  if (!range) {
    return NextResponse.json({
      skipped: true,
      reason: "publisher_not_active_this_month",
      inserted_count: 0,
    });
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
    if (error)
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
  }

  return NextResponse.json({
    skipped: false,
    inserted_count: toInsert.length,
  });
}

