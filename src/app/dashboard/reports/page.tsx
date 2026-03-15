import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { ReportsTable } from "./reports-table";
import { ReportDownload } from "./report-download";

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
  const fromDate = from ?? new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const toDate = to ?? new Date().toISOString().slice(0, 10);

  const { data: rows } = await supabase
    .from("daily_stats")
    .select("stat_date, impressions, clicks, revenue, ecpm")
    .eq("publisher_id", publisherId)
    .gte("stat_date", fromDate)
    .lte("stat_date", toDate)
    .order("stat_date", { ascending: false })
    .limit(500);

  const totalImpressions = rows?.reduce((s, r) => s + Number(r.impressions), 0) ?? 0;
  const totalClicks = rows?.reduce((s, r) => s + Number(r.clicks), 0) ?? 0;
  const totalRevenue = rows?.reduce((s, r) => s + Number(r.revenue), 0) ?? 0;
  const avgEcpm = totalImpressions > 0 ? (totalRevenue / totalImpressions) * 1000 : 0;

  return (
    <div>
      <h1 className="text-2xl font-semibold text-gray-900 mb-6">Reports</h1>
      <ReportsTable
        rows={rows ?? []}
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
