import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { ReportsTable } from "./reports-table";
import { ReportDownload } from "./report-download";
import { getEffectiveStatsAtTime } from "@/lib/time-segments";

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("publisher_id")
    .eq("id", user.id)
    .single();
  const publisherId = profile?.publisher_id;
  if (!publisherId) redirect("/login");

  const { from, to } = await searchParams;
  const nowLocal = new Date();
  const toDate =
    to ?? nowLocal.toISOString().slice(0, 10);
  const fromDate =
    from ??
    new Date(
      nowLocal.getTime() - 30 * 24 * 60 * 60 * 1000
    )
      .toISOString()
      .slice(0, 10);

  // Note: this query returns only dates that have stored rows in daily_stats.
  // We do not generate placeholder rows for missing dates in the range.
  const { data: rawRows } = await supabase
    .from("daily_stats")
    .select("stat_date, impressions, clicks, revenue, ecpm, time_segments")
    .eq("publisher_id", publisherId)
    .gte("stat_date", fromDate)
    .lte("stat_date", toDate)
    .order("stat_date", { ascending: false })
    .limit(500);

  const now = new Date();
  const rows = (rawRows ?? []).map((r) => {
    if (r.stat_date === toDate && r.time_segments && Array.isArray(r.time_segments)) {
      const effective = getEffectiveStatsAtTime(
        {
          stat_date: r.stat_date,
          revenue: Number(r.revenue) ?? 0,
          impressions: Number(r.impressions) ?? 0,
          clicks: Number(r.clicks) ?? 0,
          time_segments: r.time_segments,
        },
        now,
        toDate
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

  const totalImpressions = rows.reduce((s, r) => s + r.impressions, 0);
  const totalClicks = rows.reduce((s, r) => s + r.clicks, 0);
  const totalRevenue = rows.reduce((s, r) => s + r.revenue, 0);
  const avgEcpm = totalImpressions > 0 ? (totalRevenue / totalImpressions) * 1000 : 0;

  return (
    <div>
      <h1 className="text-2xl font-semibold text-gray-900 mb-6">Reports</h1>
      <ReportsTable
        rows={rows}
        from={fromDate}
        to={toDate}
        summary={{
          impressions: totalImpressions,
          clicks: totalClicks,
          revenue: totalRevenue,
          ecpm: avgEcpm,
        }}
      />
      <div className="mt-6">
        <ReportDownload publisherId={publisherId} />
      </div>
    </div>
  );
}
