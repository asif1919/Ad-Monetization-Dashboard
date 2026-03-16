"use client";

const CURRENCY = "৳";

function formatMoney(n: number) {
  return `${CURRENCY}${n.toFixed(2)}`;
}

function formatPct(n: number) {
  return `${n.toFixed(2)}%`;
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

export function OverviewCards({
  todayRevenue,
  yesterdayRevenue,
  monthlyRevenue,
  todayImpressions,
  yesterdayImpressions,
  monthlyImpressions,
  todayEcpm,
  yesterdayEcpm,
  monthlyEcpm,
  revenueGrowth,
  impressionsGrowth,
  ecpmGrowth,
}: {
  todayRevenue: number;
  yesterdayRevenue: number;
  monthlyRevenue: number;
  todayImpressions: number;
  yesterdayImpressions: number;
  monthlyImpressions: number;
  todayEcpm: number;
  yesterdayEcpm: number;
  monthlyEcpm: number;
  revenueGrowth: number;
  impressionsGrowth: number;
  ecpmGrowth: number;
}) {
  const fillRateGrowth = 0;

  return (
    <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
      {/* Revenue */}
      <div className="rounded-lg bg-white p-4 border border-gray-200 shadow-sm">
        <p className="text-sm font-medium text-gray-900 mb-3">Revenue</p>
        <div className="space-y-1 text-sm">
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
            <span className="text-gray-600">Monthly Growth Rate</span>
            <GrowthBadge value={revenueGrowth} />
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
            <span className="text-gray-600">Monthly Growth Rate</span>
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
            <span className="text-gray-600">Monthly Growth Rate</span>
            <GrowthBadge value={impressionsGrowth} />
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
            <span className="text-gray-600">Monthly Growth Rate</span>
            <GrowthBadge value={ecpmGrowth} />
          </div>
        </div>
      </div>
    </div>
  );
}
