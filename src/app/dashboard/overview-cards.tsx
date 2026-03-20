"use client";

import { useCurrency } from "@/components/currency/currency-provider";
import { getEffectiveStatsAtTimeLocal } from "@/lib/time-segments";
import type { TimeSegment } from "@/lib/supabase/types";
import { useState, useEffect } from "react";

function formatPct(n: number) {
  return `${n.toFixed(2)}%`;
}

function progressVsYesterday(today: number, yesterday: number) {
  if (yesterday <= 0) return 0;
  return ((today - yesterday) / yesterday) * 100;
}

function GrowthBadge({ value }: { value: number }) {
  const isUp = value >= 0;
  return (
    <span
      className={
        isUp
          ? "text-green-600 text-sm font-medium"
          : "text-red-600 text-sm font-medium"
      }
    >
      {formatPct(value)}
      {isUp ? " ↑" : " ↓"}
    </span>
  );
}

type RawTodayStats = {
  stat_date: string;
  revenue: number;
  impressions: number;
  clicks: number;
  time_segments?: TimeSegment[] | string | null;
} | null;

export function OverviewCards({
  rawTodayStats,
  selectedDate,
  todayHasError: serverTodayHasError,
  todayRevenue: serverTodayRevenue,
  yesterdayRevenue,
  monthlyRevenue,
  todayImpressions: serverTodayImpressions,
  yesterdayImpressions,
  monthlyImpressions,
  todayClicks: serverTodayClicks,
  yesterdayClicks,
  monthlyClicks,
  todayEcpm: serverTodayEcpm,
  yesterdayEcpm,
  monthlyEcpm,
  todayEcpc: serverTodayEcpc,
  yesterdayEcpc,
  monthlyEcpc,
  todayCtr: serverTodayCtr,
  yesterdayCtr,
  monthlyCtr,
  revenueGrowth,
  impressionsGrowth,
  clicksGrowth,
  ecpmGrowth,
  ecpcGrowth,
  ctrGrowth,
}: {
  rawTodayStats?: RawTodayStats;
  selectedDate?: string;
  todayHasError?: boolean;
  todayRevenue: number;
  yesterdayRevenue: number;
  monthlyRevenue: number;
  todayImpressions: number;
  yesterdayImpressions: number;
  monthlyImpressions: number;
  todayClicks: number;
  yesterdayClicks: number;
  monthlyClicks: number;
  todayEcpm: number;
  yesterdayEcpm: number;
  monthlyEcpm: number;
  todayEcpc: number;
  yesterdayEcpc: number;
  monthlyEcpc: number;
  todayCtr: number;
  yesterdayCtr: number;
  monthlyCtr: number;
  revenueGrowth: number;
  impressionsGrowth: number;
  clicksGrowth: number;
  ecpmGrowth: number;
  ecpcGrowth: number;
  ctrGrowth: number;
}) {
  const { formatMoney } = useCurrency();
  const fillRateGrowth = 0;

  const [clientToday, setClientToday] = useState<{
    revenue: number;
    impressions: number;
    clicks: number;
    ecpm: number;
    hadError: boolean;
  } | null>(null);

  useEffect(() => {
    if (!rawTodayStats || !selectedDate) {
      setClientToday(null);
      return;
    }
    const run = () => {
      const effective = getEffectiveStatsAtTimeLocal(
        {
          stat_date: rawTodayStats!.stat_date,
          revenue: Number(rawTodayStats!.revenue) ?? 0,
          impressions: Number(rawTodayStats!.impressions) ?? 0,
          clicks: Number(rawTodayStats!.clicks) ?? 0,
          time_segments: rawTodayStats!.time_segments ?? null,
        },
        new Date(),
        selectedDate!
      );
      const ecpm =
        effective.impressions > 0
          ? (effective.revenue / effective.impressions) * 1000
          : 0;
      setClientToday({
        revenue: effective.revenue,
        impressions: effective.impressions,
        clicks: effective.clicks,
        ecpm,
        hadError: effective.hadError ?? false,
      });
    };
    run();
    const id = setInterval(run, 60 * 1000);
    return () => clearInterval(id);
  }, [rawTodayStats, selectedDate]);

  const todayRevenue = clientToday?.revenue ?? serverTodayRevenue;
  const todayImpressions = clientToday?.impressions ?? serverTodayImpressions;
  const todayClicks = clientToday?.clicks ?? serverTodayClicks;
  const todayEcpm = clientToday?.ecpm ?? serverTodayEcpm;
  const todayEcpc = todayClicks > 0 ? todayRevenue / todayClicks : serverTodayEcpc;
  const todayCtr =
    todayImpressions > 0
      ? (todayClicks / todayImpressions) * 100
      : serverTodayCtr;
  const todayHasError = clientToday?.hadError ?? serverTodayHasError ?? false;
  const revenueProgress = progressVsYesterday(todayRevenue, yesterdayRevenue);
  const impressionsProgress = progressVsYesterday(
    todayImpressions,
    yesterdayImpressions
  );
  const clicksProgress = progressVsYesterday(todayClicks, yesterdayClicks);
  const ecpmProgress = progressVsYesterday(todayEcpm, yesterdayEcpm);
  const ecpcProgress = progressVsYesterday(todayEcpc, yesterdayEcpc);
  const ctrProgress = progressVsYesterday(todayCtr, yesterdayCtr);

  return (
    <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {/* Revenue */}
      <div className="rounded-lg bg-white p-4 border border-gray-200 shadow-sm">
        <p className="text-sm font-medium text-gray-900 mb-3">Revenue</p>
        <div className="space-y-1 text-sm">
          {todayHasError && (
            <p className="text-xs text-red-600 mb-1">
              An error occurred. Try again after some time.
            </p>
          )}
          <div className="flex justify-between">
            <span className="text-gray-600">Today</span>
            <span className="font-medium text-gray-900">
              {formatMoney(todayRevenue)}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">Yesterday</span>
            <span className="font-medium text-gray-900">
              {formatMoney(yesterdayRevenue)}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">This Month</span>
            <span className="font-medium text-gray-900">
              {formatMoney(monthlyRevenue)}
            </span>
          </div>
          <div className="flex justify-between items-center pt-2 border-t border-gray-100">
            <span className="text-gray-600">Progress vs Yesterday</span>
            <GrowthBadge value={revenueProgress} />
          </div>
        </div>
      </div>

      {/* Fill Rate - no requests in DB, show 0 */}
      <div className="rounded-lg bg-white p-4 border border-gray-200 shadow-sm">
        <p className="text-sm font-medium text-gray-900 mb-3">Fill Rate</p>
        <div className="space-y-1 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-600">Today</span>
            <span className="font-medium text-gray-900">0.00%</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">Yesterday</span>
            <span className="font-medium text-gray-900">0.00%</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">This Month</span>
            <span className="font-medium text-gray-900">0.00%</span>
          </div>
          <div className="flex justify-between items-center pt-2 border-t border-gray-100">
            <span className="text-gray-600">Progress vs Yesterday</span>
            <GrowthBadge value={fillRateGrowth} />
          </div>
        </div>
      </div>

      {/* Impressions */}
      <div className="rounded-lg bg-white p-4 border border-gray-200 shadow-sm">
        <p className="text-sm font-medium text-gray-900 mb-3">Impressions</p>
        <div className="space-y-1 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-600">Today</span>
            <span className="font-medium text-gray-900">
              {todayImpressions.toLocaleString()}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">Yesterday</span>
            <span className="font-medium text-gray-900">
              {yesterdayImpressions.toLocaleString()}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">This Month</span>
            <span className="font-medium text-gray-900">
              {monthlyImpressions.toLocaleString()}
            </span>
          </div>
          <div className="flex justify-between items-center pt-2 border-t border-gray-100">
            <span className="text-gray-600">Progress vs Yesterday</span>
            <GrowthBadge value={impressionsProgress} />
          </div>
        </div>
      </div>

      {/* Clicks */}
      <div className="rounded-lg bg-white p-4 border border-gray-200 shadow-sm">
        <p className="text-sm font-medium text-gray-900 mb-3">Clicks</p>
        <div className="space-y-1 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-600">Today</span>
            <span className="font-medium text-gray-900">
              {todayClicks.toLocaleString()}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">Yesterday</span>
            <span className="font-medium text-gray-900">
              {yesterdayClicks.toLocaleString()}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">This Month</span>
            <span className="font-medium text-gray-900">
              {monthlyClicks.toLocaleString()}
            </span>
          </div>
          <div className="flex justify-between items-center pt-2 border-t border-gray-100">
            <span className="text-gray-600">Progress vs Yesterday</span>
            <GrowthBadge value={clicksProgress} />
          </div>
        </div>
      </div>

      {/* eCPM */}
      <div className="rounded-lg bg-white p-4 border border-gray-200 shadow-sm">
        <p className="text-sm font-medium text-gray-900 mb-3">eCPM</p>
        <div className="space-y-1 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-600">Today</span>
            <span className="font-medium text-gray-900">
              {formatMoney(todayEcpm)}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">Yesterday</span>
            <span className="font-medium text-gray-900">
              {formatMoney(yesterdayEcpm)}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">This Month</span>
            <span className="font-medium text-gray-900">
              {formatMoney(monthlyEcpm)}
            </span>
          </div>
          <div className="flex justify-between items-center pt-2 border-t border-gray-100">
            <span className="text-gray-600">Progress vs Yesterday</span>
            <GrowthBadge value={ecpmProgress} />
          </div>
        </div>
      </div>

      {/* eCPC */}
      <div className="rounded-lg bg-white p-4 border border-gray-200 shadow-sm">
        <p className="text-sm font-medium text-gray-900 mb-3">eCPC</p>
        <div className="space-y-1 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-600">Today</span>
            <span className="font-medium text-gray-900">{formatMoney(todayEcpc)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">Yesterday</span>
            <span className="font-medium text-gray-900">
              {formatMoney(yesterdayEcpc)}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">This Month</span>
            <span className="font-medium text-gray-900">{formatMoney(monthlyEcpc)}</span>
          </div>
          <div className="flex justify-between items-center pt-2 border-t border-gray-100">
            <span className="text-gray-600">Progress vs Yesterday</span>
            <GrowthBadge value={ecpcProgress} />
          </div>
        </div>
      </div>

      {/* CTR */}
      <div className="rounded-lg bg-white p-4 border border-gray-200 shadow-sm">
        <p className="text-sm font-medium text-gray-900 mb-3">CTR</p>
        <div className="space-y-1 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-600">Today</span>
            <span className="font-medium text-gray-900">{todayCtr.toFixed(2)}%</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">Yesterday</span>
            <span className="font-medium text-gray-900">
              {yesterdayCtr.toFixed(2)}%
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">This Month</span>
            <span className="font-medium text-gray-900">{monthlyCtr.toFixed(2)}%</span>
          </div>
          <div className="flex justify-between items-center pt-2 border-t border-gray-100">
            <span className="text-gray-600">Progress vs Yesterday</span>
            <GrowthBadge value={ctrProgress} />
          </div>
        </div>
      </div>
    </div>
  );
}
