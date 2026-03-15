import { createClient } from "@/lib/supabase/server";
import { ConfigForm } from "./config-form";

export default async function ConfigPage() {
  const supabase = await createClient();
  const { data: configs } = await supabase
    .from("monthly_config")
    .select("id, month, year, expected_revenue, real_data_imported_at")
    .order("year", { ascending: false })
    .order("month", { ascending: false })
    .limit(12);

  return (
    <div>
      <h1 className="text-2xl font-semibold text-gray-900 mb-6">
        Revenue config (estimated data)
      </h1>
      <ConfigForm />
      <div className="mt-8 rounded-lg bg-white border border-gray-200 overflow-hidden">
        <h2 className="px-4 py-3 font-medium border-b border-gray-200">
          Monthly config
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
              <tr key={c.id} className="border-b border-gray-100">
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
          <p className="p-4 text-gray-600">No monthly config yet. Set expected revenue above.</p>
        )}
      </div>
    </div>
  );
}
