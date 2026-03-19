"use client";

import { useCurrency } from "@/components/currency/currency-provider";
import { useEffect, useMemo, useState } from "react";

type DayRow = {
  stat_date: string;
  revenue: number;
  impressions: number;
  clicks: number;
  ecpm: number;
  ecpc: number;
  ctr: number;
};

function currentMonthStr() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

export function MonthlyDataTable() {
  const { formatMoney } = useCurrency();
  const [month, setMonth] = useState(currentMonthStr());
  const [rows, setRows] = useState<DayRow[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let canceled = false;
    const load = async () => {
      setLoading(true);
      try {
        const res = await fetch(
          `/api/dashboard/monthly-table?month=${encodeURIComponent(month)}`
        );
        const data = await res.json();
        if (!canceled && res.ok) {
          setRows((data.rows ?? []) as DayRow[]);
        }
      } finally {
        if (!canceled) setLoading(false);
      }
    };
    void load();
    return () => {
      canceled = true;
    };
  }, [month]);

  const monthLabel = useMemo(() => {
    const [y, m] = month.split("-").map(Number);
    if (!y || !m) return month;
    return new Date(y, m - 1, 1).toLocaleDateString(undefined, {
      month: "long",
      year: "numeric",
    });
  }, [month]);

  return (
    <div className="mt-8">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-medium text-gray-900">Monthly Daily Data</h2>
        <input
          type="month"
          value={month}
          onChange={(e) => setMonth(e.target.value)}
          className="rounded border border-gray-300 px-3 py-1 text-sm bg-white text-gray-900"
        />
      </div>
      <p className="text-xs text-gray-600 mb-3">
        Showing {monthLabel}: only past days with data (today and future days are
        hidden).
      </p>
      <div className="rounded-lg bg-white border border-gray-200 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="text-left p-3">Date</th>
              <th className="text-left p-3">Revenue</th>
              <th className="text-left p-3">Impressions</th>
              <th className="text-left p-3">Clicks</th>
              <th className="text-left p-3">eCPM</th>
              <th className="text-left p-3">eCPC</th>
              <th className="text-left p-3">CTR</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td className="p-3 text-gray-600" colSpan={7}>
                  Loading...
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td className="p-3 text-gray-600" colSpan={7}>
                  No days to show.
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={r.stat_date} className="border-b border-gray-100">
                  <td className="p-3">
                    {new Date(`${r.stat_date}T00:00:00`).toLocaleDateString(undefined, {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </td>
                  <td className="p-3">{formatMoney(r.revenue)}</td>
                  <td className="p-3">{r.impressions.toLocaleString()}</td>
                  <td className="p-3">{r.clicks.toLocaleString()}</td>
                  <td className="p-3">{formatMoney(r.ecpm)}</td>
                  <td className="p-3">{formatMoney(r.ecpc)}</td>
                  <td className="p-3">{`${r.ctr.toFixed(2)}%`}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

