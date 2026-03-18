import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { OverviewCards } from "./overview-cards";
import { RevenueChart } from "./revenue-chart";
import { getEffectiveStatsAtTime } from "@/lib/time-segments";

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
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().slice(0, 10);
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  const monthStart = startOfMonth.toISOString().slice(0, 10);
  const last30 = new Date();
  last30.setDate(last30.getDate() - 30);
  const last30Start = last30.toISOString().slice(0, 10);
  const prevMonthStart = new Date(startOfMonth.getFullYear(), startOfMonth.getMonth() - 1, 1);
  const prevMonthEnd = new Date(startOfMonth.getFullYear(), startOfMonth.getMonth(), 0);
  const prevMonthStartStr = prevMonthStart.toISOString().slice(0, 10);
  const prevMonthEndStr = prevMonthEnd.toISOString().slice(0, 10);

  const now = new Date();
  const [todayRes, yesterdayRes, monthRes, prevMonthRes, chartRes] = await Promise.all([
    supabase
      .from("daily_stats")
      .select("stat_date, revenue, impressions, clicks, is_estimated, time_segments")
      .eq("publisher_id", publisherId)
      .eq("stat_date", today)
      .maybeSingle(),
    supabase
      .from("daily_stats")
      .select("revenue, impressions, clicks, is_estimated")
      .eq("publisher_id", publisherId)
      .eq("stat_date", yesterdayStr)
      .maybeSingle(),
    supabase
      .from("daily_stats")
      .select("stat_date, revenue, impressions, clicks, is_estimated, time_segments")
      .eq("publisher_id", publisherId)
      .gte("stat_date", monthStart)
      .lte("stat_date", today),
    supabase
      .from("daily_stats")
      .select("revenue, impressions")
      .eq("publisher_id", publisherId)
      .gte("stat_date", prevMonthStartStr)
      .lte("stat_date", prevMonthEndStr),
    supabase
      .from("daily_stats")
      .select("stat_date, revenue, impressions, ecpm, is_estimated, time_segments")
      .eq("publisher_id", publisherId)
      .gte("stat_date", last30Start)
      .lte("stat_date", today)
      .order("stat_date"),
  ]);

  const todayStats = todayRes.data;
  const yesterdayStats = yesterdayRes.data;
  const monthStats = monthRes.data;
  const prevMonthStats = prevMonthRes.data;
  let chartData = chartRes.data ?? [];

  const todayEffective = todayStats
    ? getEffectiveStatsAtTime(
        {
          stat_date: today,
          revenue: Number(todayStats.revenue) ?? 0,
          impressions: Number(todayStats.impressions) ?? 0,
          clicks: Number(todayStats.clicks) ?? 0,
          time_segments: todayStats.time_segments ?? null,
        },
        now
      )
    : { revenue: 0, impressions: 0, clicks: 0 };

  const todayRevenue = todayEffective.revenue;
  const yesterdayRevenue = Number(yesterdayStats?.revenue) ?? 0;
  const monthlyRevenue =
    monthStats?.reduce((s, r) => {
      const effective =
        r.stat_date === today && r.time_segments
          ? getEffectiveStatsAtTime(
              {
                stat_date: r.stat_date,
                revenue: Number(r.revenue) ?? 0,
                impressions: Number(r.impressions) ?? 0,
                clicks: Number(r.clicks) ?? 0,
                time_segments: r.time_segments,
              },
              now
            )
          : null;
      return s + (effective ? effective.revenue : Number(r.revenue) ?? 0);
    }, 0) ?? 0;
  const prevMonthRevenue =
    prevMonthStats?.reduce((s, r) => s + Number(r.revenue), 0) ?? 0;

  const todayImpressions = todayEffective.impressions;
  const yesterdayImpressions = Number(yesterdayStats?.impressions) ?? 0;
  const monthlyImpressions =
    monthStats?.reduce((s, r) => {
      const effective =
        r.stat_date === today && r.time_segments
          ? getEffectiveStatsAtTime(
              {
                stat_date: r.stat_date,
                revenue: Number(r.revenue) ?? 0,
                impressions: Number(r.impressions) ?? 0,
                clicks: Number(r.clicks) ?? 0,
                time_segments: r.time_segments,
              },
              now
            )
          : null;
      return s + (effective ? effective.impressions : Number(r.impressions) ?? 0);
    }, 0) ?? 0;
  const prevMonthImpressions =
    prevMonthStats?.reduce((s, r) => s + Number(r.impressions), 0) ?? 0;

  const monthlyClicks =
    monthStats?.reduce((s, r) => {
      const effective =
        r.stat_date === today && r.time_segments
          ? getEffectiveStatsAtTime(
              {
                stat_date: r.stat_date,
                revenue: Number(r.revenue) ?? 0,
                impressions: Number(r.impressions) ?? 0,
                clicks: Number(r.clicks) ?? 0,
                time_segments: r.time_segments,
              },
              now
            )
          : null;
      return s + (effective ? effective.clicks : Number(r.clicks) ?? 0);
    }, 0) ?? 0;
  const monthlyEcpm =
    monthlyImpressions > 0 ? (monthlyRevenue / monthlyImpressions) * 1000 : 0;
  const todayEcpm =
    todayImpressions > 0 ? (todayRevenue / todayImpressions) * 1000 : 0;
  const yesterdayEcpm =
    yesterdayImpressions > 0
      ? (yesterdayRevenue / yesterdayImpressions) * 1000
      : 0;

  const prevMonthEcpm =
    prevMonthImpressions > 0
      ? (prevMonthRevenue / prevMonthImpressions) * 1000
      : 0;
  const revenueGrowth =
    prevMonthRevenue > 0
      ? ((monthlyRevenue - prevMonthRevenue) / prevMonthRevenue) * 100
      : 0;
  const impressionsGrowth =
    prevMonthImpressions > 0
      ? ((monthlyImpressions - prevMonthImpressions) / prevMonthImpressions) * 100
      : 0;
  const ecpmGrowth =
    prevMonthEcpm > 0
      ? ((monthlyEcpm - prevMonthEcpm) / prevMonthEcpm) * 100
      : 0;

  chartData = chartData.map((d: { stat_date: string; revenue?: number; impressions?: number; ecpm?: number; time_segments?: unknown }) => {
    if (d.stat_date === today && d.time_segments) {
      const effective = getEffectiveStatsAtTime(
        {
          stat_date: d.stat_date,
          revenue: Number(d.revenue) ?? 0,
          impressions: Number(d.impressions) ?? 0,
          clicks: 0,
          time_segments: d.time_segments as { start: string; end: string; revenue: number; impressions: number; clicks: number }[],
        },
        now
      );
      const ecpm =
        effective.impressions > 0
          ? (effective.revenue / effective.impressions) * 1000
          : 0;
      return {
        ...d,
        revenue: effective.revenue,
        impressions: effective.impressions,
        ecpm,
      };
    }
    return d;
  });

  const hasRealDataThisMonth = (monthStats ?? []).some((r) => r.is_estimated === false);
  const showEstimatedBadge = (monthStats ?? []).length > 0 && !hasRealDataThisMonth;

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <h1 className="text-2xl font-semibold text-gray-900">Overview</h1>
        {showEstimatedBadge && (
          <span
            className="inline-flex items-center rounded-md bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-800 ring-1 ring-inset ring-amber-600/20"
            title="Numbers are based on monthly targets until real data is imported."
          >
            Estimated until month-end
          </span>
        )}
      </div>
      <OverviewCards
        todayRevenue={todayRevenue}
        yesterdayRevenue={yesterdayRevenue}
        monthlyRevenue={monthlyRevenue}
        todayImpressions={todayImpressions}
        yesterdayImpressions={yesterdayImpressions}
        monthlyImpressions={monthlyImpressions}
        todayEcpm={todayEcpm}
        yesterdayEcpm={yesterdayEcpm}
        monthlyEcpm={monthlyEcpm}
        revenueGrowth={revenueGrowth}
        impressionsGrowth={impressionsGrowth}
        ecpmGrowth={ecpmGrowth}
      />
      <div className="mt-8">
        <div className="flex items-center gap-2 mb-4">
          <h2 className="text-lg font-medium text-gray-900">
            Revenue trend (last 30 days)
          </h2>
          {showEstimatedBadge && (
            <span className="text-xs text-amber-700">Estimated data</span>
          )}
        </div>
        <RevenueChart data={chartData ?? []} />
      </div>
    </div>
  );
}
