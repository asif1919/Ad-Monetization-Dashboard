"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

type Row = { stat_date: string; revenue?: number; impressions?: number; ecpm?: number };

export function RevenueChart({ data }: { data: Row[] }) {
  const chartData = data.map((d) => ({
    date: d.stat_date?.slice(5) ?? "",
    revenue: Number(d.revenue) ?? 0,
    impressions: Number(d.impressions) ?? 0,
    ecpm: Number(d.ecpm) ?? 0,
  }));

  if (chartData.length === 0) {
    return (
      <div className="rounded-lg bg-white border border-gray-200 p-8 text-center text-gray-700">
        No data for the last 30 days.
      </div>
    );
  }

  return (
    <div className="rounded-lg bg-white border border-gray-200 p-4 h-80">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
          <XAxis dataKey="date" tick={{ fontSize: 12 }} />
          <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => `$${v}`} />
          <Tooltip formatter={(v: number) => [`$${Number(v).toFixed(2)}`, "Revenue"]} />
          <Line
            type="monotone"
            dataKey="revenue"
            stroke="#2563eb"
            strokeWidth={2}
            dot={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
