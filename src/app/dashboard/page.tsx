import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { OverviewCards } from "./overview-cards";
import { RevenueChart } from "./revenue-chart";

export default async function DashboardOverviewPage() {
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

  const today = new Date().toISOString().slice(0, 10);
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  const monthStart = startOfMonth.toISOString().slice(0, 10);

  const { data: todayStats } = await supabase
    .from("daily_stats")
    .select("revenue, impressions, clicks")
    .eq("publisher_id", publisherId)
    .eq("stat_date", today)
    .maybeSingle();

  const { data: monthStats } = await supabase
    .from("daily_stats")
    .select("revenue, impressions, clicks")
    .eq("publisher_id", publisherId)
    .gte("stat_date", monthStart)
    .lte("stat_date", today);

  const monthlyRevenue =
    monthStats?.reduce((s, r) => s + Number(r.revenue), 0) ?? 0;
  const monthlyImpressions =
    monthStats?.reduce((s, r) => s + Number(r.impressions), 0) ?? 0;
  const monthlyClicks = monthStats?.reduce((s, r) => s + Number(r.clicks), 0) ?? 0;
  const ecpm = monthlyImpressions > 0 ? (monthlyRevenue / monthlyImpressions) * 1000 : 0;

  const { data: pendingPayout } = await supabase
    .from("payouts")
    .select("amount")
    .eq("publisher_id", publisherId)
    .eq("status", "pending")
    .order("year", { ascending: false })
    .order("month", { ascending: false })
    .limit(1)
    .maybeSingle();

  const last30 = new Date();
  last30.setDate(last30.getDate() - 30);
  const last30Start = last30.toISOString().slice(0, 10);
  const { data: chartData } = await supabase
    .from("daily_stats")
    .select("stat_date, revenue, impressions, ecpm")
    .eq("publisher_id", publisherId)
    .gte("stat_date", last30Start)
    .lte("stat_date", today)
    .order("stat_date");

  return (
    <div>
      <h1 className="text-2xl font-semibold text-gray-900 mb-6">Overview</h1>
      <OverviewCards
        todayRevenue={Number(todayStats?.revenue) ?? 0}
        monthlyRevenue={monthlyRevenue}
        impressions={monthlyImpressions}
        clicks={monthlyClicks}
        ecpm={ecpm}
        paymentDue={Number(pendingPayout?.amount) ?? 0}
      />
      <div className="mt-8">
        <h2 className="text-lg font-medium text-gray-900 mb-4">
          Revenue trend (last 30 days)
        </h2>
        <RevenueChart data={chartData ?? []} />
      </div>
    </div>
  );
}
