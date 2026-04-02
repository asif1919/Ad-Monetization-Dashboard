import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { FormattedMoney } from "@/components/currency/formatted-money";

export default async function AdminOverviewPage() {
  const supabase = await createClient();
  const today = new Date().toISOString().slice(0, 10);
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  const monthStart = startOfMonth.toISOString().slice(0, 10);

  const [countRes, configsRes, todayStatsRes, monthStatsRes, payoutsRes, activeRes] =
    await Promise.all([
      supabase.from("publishers").select("*", { count: "exact", head: true }),
      supabase
        .from("monthly_config")
        .select("month, year, expected_revenue")
        .order("year", { ascending: false })
        .order("month", { ascending: false })
        .limit(5),
      supabase
        .from("daily_stats")
        .select("revenue, impressions")
        .eq("stat_date", today),
      supabase
        .from("daily_stats")
        .select("revenue, impressions")
        .gte("stat_date", monthStart)
        .lte("stat_date", today),
      supabase
        .from("payouts")
        .select("amount")
        .eq("status", "pending"),
      supabase
        .from("publishers")
        .select("id", { count: "exact", head: true })
        .eq("status", "active"),
    ]);

  const publishersCount = countRes.count ?? 0;
  const configs = configsRes.data ?? [];

  const todayRows = todayStatsRes.data ?? [];
  const monthRows = monthStatsRes.data ?? [];
  const payouts = payoutsRes.data ?? [];
  const activePublishers = activeRes.count ?? 0;

  const todayRevenue =
    todayRows.reduce((s, r) => s + Number((r as any).revenue ?? 0), 0) ?? 0;
  const monthRevenue =
    monthRows.reduce((s, r) => s + Number((r as any).revenue ?? 0), 0) ?? 0;
  const monthImpressions =
    monthRows.reduce((s, r) => s + Number((r as any).impressions ?? 0), 0) ?? 0;
  const avgEcpm =
    monthImpressions > 0 ? (monthRevenue / monthImpressions) * 1000 : 0;

  const pendingPayoutsCount = payouts.length;
  const pendingPayoutsAmount =
    payouts.reduce((s, p) => s + Number((p as any).amount ?? 0), 0) ?? 0;

  return (
    <div>
      <h1 className="text-2xl font-semibold text-gray-900 mb-6">Overview</h1>
      <div className="grid gap-4 md:grid-cols-3 mb-8">
        <div className="rounded-lg bg-white p-4 shadow border border-gray-200">
          <p className="text-sm text-gray-700">Total publishers</p>
          <p className="text-2xl font-semibold">{publishersCount}</p>
          <Link href="/admin/publishers" className="text-blue-600 text-sm hover:underline">
            Manage
          </Link>
        </div>
        <div className="rounded-lg bg-white p-4 shadow border border-gray-200">
          <p className="text-sm text-gray-700">Network revenue (today)</p>
          <p className="text-2xl font-semibold">
            <FormattedMoney amountUsd={todayRevenue} />
          </p>
        </div>
        <div className="rounded-lg bg-white p-4 shadow border border-gray-200">
          <p className="text-sm text-gray-700">Network revenue (this month)</p>
          <p className="text-2xl font-semibold">
            <FormattedMoney amountUsd={monthRevenue} />
          </p>
        </div>
        <div className="rounded-lg bg-white p-4 shadow border border-gray-200">
          <p className="text-sm text-gray-700">Impressions (this month)</p>
          <p className="text-2xl font-semibold">
            {monthImpressions.toLocaleString()}
          </p>
        </div>
        <div className="rounded-lg bg-white p-4 shadow border border-gray-200">
          <p className="text-sm text-gray-700">Average eCPM (this month)</p>
          <p className="text-2xl font-semibold">
            <FormattedMoney amountUsd={avgEcpm} />
          </p>
        </div>
        <div className="rounded-lg bg-white p-4 shadow border border-gray-200">
          <p className="text-sm text-gray-700">Pending payouts</p>
          <p className="text-2xl font-semibold">
            {pendingPayoutsCount} · <FormattedMoney amountUsd={pendingPayoutsAmount} />
          </p>
        </div>
        <div className="rounded-lg bg-white p-4 shadow border border-gray-200">
          <p className="text-sm text-gray-700">Active publishers</p>
          <p className="text-2xl font-semibold">{activePublishers}</p>
        </div>
      </div>
      <div className="rounded-lg bg-white border border-gray-200 overflow-hidden">
        <h2 className="px-4 py-3 font-medium border-b border-gray-200">
          Recent monthly config
        </h2>
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="text-left p-3">Month / Year</th>
              <th className="text-left p-3">Expected revenue</th>
            </tr>
          </thead>
          <tbody>
            {configs.map((c) => (
              <tr key={`${c.year}-${c.month}`} className="border-b border-gray-100">
                <td className="p-3">
                  {c.month}/{c.year}
                </td>
                <td className="p-3"><FormattedMoney amountUsd={Number(c.expected_revenue)} /></td>
              </tr>
            ))}
          </tbody>
        </table>
        {configs.length === 0 && (
          <p className="p-4 text-gray-600">No monthly config yet.</p>
        )}
      </div>
    </div>
  );
}
