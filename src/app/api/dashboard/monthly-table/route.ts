import { createClient } from "@/lib/supabase/server";
import { requireDashboardPublisherForApi } from "@/lib/dashboard-effective-publisher";
import { NextResponse } from "next/server";

type DayRow = {
  stat_date: string;
  revenue: number;
  impressions: number;
  clicks: number;
  ecpm: number;
  ecpc: number;
  ctr: number;
};

export async function GET(request: Request) {
  const supabase = await createClient();
  const scope = await requireDashboardPublisherForApi(supabase);
  if ("response" in scope) return scope.response;
  const { publisherId } = scope;

  const { searchParams } = new URL(request.url);
  const monthParam = searchParams.get("month"); // YYYY-MM
  if (!monthParam || !/^\d{4}-\d{2}$/.test(monthParam)) {
    return NextResponse.json({ error: "month must be YYYY-MM" }, { status: 400 });
  }

  const yearNum = Number(monthParam.slice(0, 4));
  const monthNum = Number(monthParam.slice(5, 7));
  if (
    !Number.isFinite(yearNum) ||
    !Number.isFinite(monthNum) ||
    monthNum < 1 ||
    monthNum > 12
  ) {
    return NextResponse.json({ error: "Invalid month" }, { status: 400 });
  }

  const daysInMonth = new Date(yearNum, monthNum, 0).getDate();
  const startDate = `${yearNum}-${String(monthNum).padStart(2, "0")}-01`;
  const endDate = `${yearNum}-${String(monthNum).padStart(2, "0")}-${String(daysInMonth).padStart(2, "0")}`;
  const todayUtc = new Date().toISOString().slice(0, 10);

  const { data: stats } = await supabase
    .from("daily_stats")
    .select("stat_date, revenue, impressions, clicks, ecpm")
    .eq("publisher_id", publisherId)
    .gte("stat_date", startDate)
    .lte("stat_date", endDate);

  const byDate = new Map(
    (stats ?? []).map((r) => [
      r.stat_date as string,
      {
        revenue: Number(r.revenue),
        impressions: Number(r.impressions),
        clicks: Number(r.clicks),
        ecpm: Number(r.ecpm),
      },
    ])
  );

  // Only past days (strictly before today UTC): no today, no future.
  // Only rows that have data in DB (no empty placeholder rows).
  const rows: DayRow[] = [];
  for (let day = 1; day <= daysInMonth; day++) {
    const statDate = `${yearNum}-${String(monthNum).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    if (statDate >= todayUtc) continue;
    const existing = byDate.get(statDate);
    if (!existing) continue;
    rows.push({
      stat_date: statDate,
      revenue: existing.revenue,
      impressions: existing.impressions,
      clicks: existing.clicks,
      ecpm: existing.ecpm,
      ecpc: existing.clicks > 0 ? existing.revenue / existing.clicks : 0,
      ctr:
        existing.impressions > 0
          ? (existing.clicks / existing.impressions) * 100
          : 0,
    });
  }

  return NextResponse.json({ rows });
}

