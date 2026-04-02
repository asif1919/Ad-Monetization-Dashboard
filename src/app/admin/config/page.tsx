import { createClient } from "@/lib/supabase/server";
import { FormattedMoney } from "@/components/currency/formatted-money";

export default async function AdminConfigPage() {
  const supabase = await createClient();
  const { data: configs } = await supabase
    .from("monthly_config")
    .select("id, month, year, expected_revenue")
    .order("year", { ascending: false })
    .order("month", { ascending: false });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900 mb-2">
          Revenue configuration
        </h1>
        <p className="text-sm text-gray-700">
          View monthly revenue expectations. Targets and daily stats generation are managed under{" "}
          <strong>Revenue &amp; Payouts</strong>.
        </p>
      </div>

      <section className="rounded-lg border border-gray-200 bg-white p-4">
        <h2 className="text-sm font-medium text-gray-900 mb-3">Monthly configs</h2>
        {configs && configs.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="text-left p-2">Month</th>
                  <th className="text-left p-2">Expected revenue</th>
                </tr>
              </thead>
              <tbody>
                {configs.map((c) => (
                  <tr key={c.id} className="border-b border-gray-100">
                    <td className="p-2">
                      {String(c.month).padStart(2, "0")}/{c.year}
                    </td>
                    <td className="p-2">
                      {typeof c.expected_revenue === "number" ? (
                        <FormattedMoney amountUsd={Number(c.expected_revenue)} />
                      ) : (
                        "—"
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-gray-600">
            No monthly configs yet. You can create them via the estimates API.
          </p>
        )}
      </section>
    </div>
  );
}
