import { createClient } from "@/lib/supabase/server";
import { requireDashboardPublisherForApi } from "@/lib/dashboard-effective-publisher";
import { NextResponse } from "next/server";
import { getEffectiveStatsAtTime } from "@/lib/time-segments";

export async function GET(request: Request) {
  const supabase = await createClient();
  const scope = await requireDashboardPublisherForApi(supabase);
  if ("response" in scope) return scope.response;
  const { publisherId } = scope;

  const { searchParams } = new URL(request.url);
  const month = searchParams.get("month");
  const year = searchParams.get("year");
  if (!month || !year) {
    return NextResponse.json({ error: "month and year required" }, { status: 400 });
  }
  const monthNum = parseInt(month, 10);
  const yearNum = parseInt(year, 10);
  if (Number.isNaN(monthNum) || Number.isNaN(yearNum)) {
    return NextResponse.json({ error: "Invalid month or year" }, { status: 400 });
  }

  const startDate = `${yearNum}-${String(monthNum).padStart(2, "0")}-01`;
  const endDate = `${yearNum}-${String(monthNum).padStart(2, "0")}-${String(new Date(yearNum, monthNum, 0).getDate()).padStart(2, "0")}`;

  const { data: rawRows } = await supabase
    .from("daily_stats")
    .select("stat_date, impressions, clicks, revenue, ecpm, time_segments")
    .eq("publisher_id", publisherId)
    .gte("stat_date", startDate)
    .lte("stat_date", endDate)
    .order("stat_date");

  if (!rawRows?.length) {
    return NextResponse.json(
      {
        error:
          "No daily stats for this month yet. Generate estimates from the admin Revenue & Payouts page when you have a monthly target.",
      },
      { status: 403 }
    );
  }

  const now = new Date();
  const rows = (rawRows ?? []).map((r) => {
    if (r.stat_date === endDate && r.time_segments && Array.isArray(r.time_segments)) {
      const effective = getEffectiveStatsAtTime(
        {
          stat_date: r.stat_date,
          revenue: Number(r.revenue) ?? 0,
          impressions: Number(r.impressions) ?? 0,
          clicks: Number(r.clicks) ?? 0,
          time_segments: r.time_segments,
        },
        now,
        endDate
      );
      const ecpm =
        effective.impressions > 0
          ? (effective.revenue / effective.impressions) * 1000
          : 0;
      return {
        stat_date: r.stat_date,
        impressions: effective.impressions,
        clicks: effective.clicks,
        revenue: effective.revenue,
        ecpm,
      };
    }
    return {
      stat_date: r.stat_date,
      impressions: Number(r.impressions) ?? 0,
      clicks: Number(r.clicks) ?? 0,
      revenue: Number(r.revenue) ?? 0,
      ecpm: Number(r.ecpm) ?? 0,
    };
  });

  const header = "Date,Impressions,Clicks,Revenue,eCPM\n";
  const body = rows
    .map(
      (r) =>
        `${r.stat_date},${r.impressions},${r.clicks},${Number(r.revenue).toFixed(2)},${Number(r.ecpm).toFixed(2)}`
    )
    .join("\n");
  const csv = header + body;

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename="report-${yearNum}-${String(monthNum).padStart(2, "0")}.csv"`,
    },
  });
}
