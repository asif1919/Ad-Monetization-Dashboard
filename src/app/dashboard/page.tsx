import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { OverviewCards } from "./overview-cards";
import { RevenueChart } from "./revenue-chart";
import { getEffectiveStatsAtTime } from "@/lib/time-segments";
import { CurrentDateLabel } from "./current-date-label";
import { MonthlyDataTable } from "./monthly-table";

export const dynamic = "force-dynamic";

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

  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  const anchor = new Date(today + "T12:00:00.000Z");
  const yesterday = new Date(anchor);
  yesterday.setUTCDate(anchor.getUTCDate() - 1);
  const yesterdayStr = yesterday.toISOString().slice(0, 10);
  const startOfMonth = new Date(
    Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth(), 1)
  );
  const monthStart = startOfMonth.toISOString().slice(0, 10);
  const chartLast30 = new Date(today + "T00:00:00Z");
  chartLast30.setUTCDate(chartLast30.getUTCDate() - 30);
  const chartLast30Start = chartLast30.toISOString().slice(0, 10);
  const realToday = today;
  const y = anchor.getUTCFullYear();
  const m = anchor.getUTCMonth();
  const prevMonthStart = new Date(Date.UTC(y, m - 1, 1));
  const prevMonthEnd = new Date(Date.UTC(y, m, 0));
  const prevMonthStartStr = prevMonthStart.toISOString().slice(0, 10);
  const prevMonthEndStr = prevMonthEnd.toISOString().slice(0, 10);

  if (process.env.NODE_ENV !== "production" || process.env.LOG_PROGRESSIVE === "1") {
    console.log("[dashboard/overview]", {
      today,
      nowUtc: now.toISOString().slice(0, 16),
      nowMinutes: now.getUTCHours() * 60 + now.getUTCMinutes(),
    });
  }
  const [todayRes, yesterdayRes, monthRes, prevMonthRes, chartRes] = await Promise.all([
    supabase
      .from("daily_stats")
      .select("stat_date, revenue, impressions, clicks, time_segments")
      .eq("publisher_id", publisherId)
      .eq("stat_date", today)
      .maybeSingle(),
    supabase
      .from("daily_stats")
      .select("revenue, impressions, clicks")
      .eq("publisher_id", publisherId)
      .eq("stat_date", yesterdayStr)
      .maybeSingle(),
    supabase
      .from("daily_stats")
      .select("stat_date, revenue, impressions, clicks, time_segments")
      .eq("publisher_id", publisherId)
      .gte("stat_date", monthStart)
      .lte("stat_date", today),
    supabase
      .from("daily_stats")
      .select("revenue, impressions, clicks")
      .eq("publisher_id", publisherId)
      .gte("stat_date", prevMonthStartStr)
      .lte("stat_date", prevMonthEndStr),
    supabase
      .from("daily_stats")
      .select("stat_date, revenue, impressions, ecpm, time_segments")
      .eq("publisher_id", publisherId)
      .gte("stat_date", chartLast30Start)
      .lte("stat_date", realToday)
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
        now,
        today
      )
    : { revenue: 0, impressions: 0, clicks: 0, hadError: false };

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
              now,
              today
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
              now,
              today
            )
          : null;
      return s + (effective ? effective.impressions : Number(r.impressions) ?? 0);
    }, 0) ?? 0;
  const prevMonthImpressions =
    prevMonthStats?.reduce((s, r) => s + Number(r.impressions), 0) ?? 0;

  const todayClicks = todayEffective.clicks;
  const yesterdayClicks = Number(yesterdayStats?.clicks) ?? 0;
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
              now,
              today
            )
          : null;
      return s + (effective ? effective.clicks : Number(r.clicks) ?? 0);
    }, 0) ?? 0;
  const prevMonthClicks =
    prevMonthStats?.reduce((s, r) => s + Number(r.clicks ?? 0), 0) ?? 0;
  const todayHasError = !!todayEffective.hadError;

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
  const monthlyEcpc = monthlyClicks > 0 ? monthlyRevenue / monthlyClicks : 0;
  const todayEcpc = todayClicks > 0 ? todayRevenue / todayClicks : 0;
  const yesterdayEcpc =
    yesterdayClicks > 0 ? yesterdayRevenue / yesterdayClicks : 0;
  const prevMonthEcpc =
    prevMonthClicks > 0 ? prevMonthRevenue / prevMonthClicks : 0;
  const monthlyCtr =
    monthlyImpressions > 0 ? (monthlyClicks / monthlyImpressions) * 100 : 0;
  const todayCtr =
    todayImpressions > 0 ? (todayClicks / todayImpressions) * 100 : 0;
  const yesterdayCtr =
    yesterdayImpressions > 0
      ? (yesterdayClicks / yesterdayImpressions) * 100
      : 0;
  const prevMonthCtr =
    prevMonthImpressions > 0
      ? (prevMonthClicks / prevMonthImpressions) * 100
      : 0;
  const revenueGrowth =
    prevMonthRevenue > 0
      ? ((monthlyRevenue - prevMonthRevenue) / prevMonthRevenue) * 100
      : 0;
  const clicksGrowth =
    prevMonthClicks > 0
      ? ((monthlyClicks - prevMonthClicks) / prevMonthClicks) * 100
      : 0;
  const impressionsGrowth =
    prevMonthImpressions > 0
      ? ((monthlyImpressions - prevMonthImpressions) / prevMonthImpressions) * 100
      : 0;
  const ecpmGrowth =
    prevMonthEcpm > 0
      ? ((monthlyEcpm - prevMonthEcpm) / prevMonthEcpm) * 100
      : 0;
  const ecpcGrowth =
    prevMonthEcpc > 0
      ? ((monthlyEcpc - prevMonthEcpc) / prevMonthEcpc) * 100
      : 0;
  const ctrGrowth =
    prevMonthCtr > 0 ? ((monthlyCtr - prevMonthCtr) / prevMonthCtr) * 100 : 0;

  chartData = chartData.map((d) => {
    if (d.stat_date === realToday && d.time_segments) {
      const effective = getEffectiveStatsAtTime(
        {
          stat_date: d.stat_date,
          revenue: Number(d.revenue) ?? 0,
          impressions: Number(d.impressions) ?? 0,
          clicks: 0,
          time_segments: d.time_segments as {
            start: string;
            end: string;
            revenue: number;
            impressions: number;
            clicks: number;
          }[],
        },
        now,
        realToday
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
  }) as typeof chartData;

  return (
    <div>
      <div className="flex items-center gap-3 mb-2">
        <h1 className="text-2xl font-semibold text-gray-900">Overview</h1>
      </div>
      <CurrentDateLabel />
      <OverviewCards
        rawTodayStats={
          todayStats
            ? {
                stat_date: today,
                revenue: Number(todayStats.revenue) ?? 0,
                impressions: Number(todayStats.impressions) ?? 0,
                clicks: Number(todayStats.clicks) ?? 0,
                time_segments: todayStats.time_segments ?? undefined,
              }
            : null
        }
        selectedDate={today}
        todayHasError={todayHasError}
        todayRevenue={todayRevenue}
        yesterdayRevenue={yesterdayRevenue}
        monthlyRevenue={monthlyRevenue}
        todayImpressions={todayImpressions}
        yesterdayImpressions={yesterdayImpressions}
        monthlyImpressions={monthlyImpressions}
        todayClicks={todayClicks}
        yesterdayClicks={yesterdayClicks}
        monthlyClicks={monthlyClicks}
        todayEcpm={todayEcpm}
        yesterdayEcpm={yesterdayEcpm}
        monthlyEcpm={monthlyEcpm}
        todayEcpc={todayEcpc}
        yesterdayEcpc={yesterdayEcpc}
        monthlyEcpc={monthlyEcpc}
        todayCtr={todayCtr}
        yesterdayCtr={yesterdayCtr}
        monthlyCtr={monthlyCtr}
        revenueGrowth={revenueGrowth}
        impressionsGrowth={impressionsGrowth}
        clicksGrowth={clicksGrowth}
        ecpmGrowth={ecpmGrowth}
        ecpcGrowth={ecpcGrowth}
        ctrGrowth={ctrGrowth}
      />
      <div className="mt-8">
        <div className="flex items-center gap-2 mb-4">
          <h2 className="text-lg font-medium text-gray-900">
            Revenue trend (last 30 days)
          </h2>
        </div>
        <RevenueChart data={chartData ?? []} />
      </div>
      <MonthlyDataTable />
    </div>
  );
}
