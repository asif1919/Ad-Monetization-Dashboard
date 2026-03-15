import { createClient } from "@/lib/supabase/server";
import Link from "next/link";

export default async function AdminOverviewPage() {
  const supabase = await createClient();
  const { count: publishersCount } = await supabase
    .from("publishers")
    .select("*", { count: "exact", head: true });
  const { data: configs } = await supabase
    .from("monthly_config")
    .select("month, year, expected_revenue, real_data_imported_at")
    .order("year", { ascending: false })
    .order("month", { ascending: false })
    .limit(5);

  return (
    <div>
      <h1 className="text-2xl font-semibold text-gray-900 mb-6">Overview</h1>
      <div className="grid gap-4 md:grid-cols-3 mb-8">
        <div className="rounded-lg bg-white p-4 shadow border border-gray-200">
          <p className="text-sm text-gray-700">Publishers</p>
          <p className="text-2xl font-semibold">{publishersCount ?? 0}</p>
          <Link href="/admin/publishers" className="text-blue-600 text-sm hover:underline">
            Manage
          </Link>
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
              <th className="text-left p-3">Real data imported</th>
            </tr>
          </thead>
          <tbody>
            {(configs ?? []).map((c) => (
              <tr key={`${c.year}-${c.month}`} className="border-b border-gray-100">
                <td className="p-3">
                  {c.month}/{c.year}
                </td>
                <td className="p-3">${Number(c.expected_revenue).toFixed(2)}</td>
                <td className="p-3">
                  {c.real_data_imported_at
                    ? new Date(c.real_data_imported_at).toLocaleDateString()
                    : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {(!configs || configs.length === 0) && (
          <p className="p-4 text-gray-600">No monthly config yet.</p>
        )}
      </div>
    </div>
  );
}
