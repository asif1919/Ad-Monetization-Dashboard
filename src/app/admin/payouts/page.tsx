import { createClient } from "@/lib/supabase/server";
import { PayoutActions } from "./payout-actions";
import { FormattedMoney } from "@/components/currency/formatted-money";

export default async function PayoutsPage() {
  const supabase = await createClient();
  const { data: payouts } = await supabase
    .from("payouts")
    .select("id, publisher_id, month, year, amount, status, paid_at, publishers(name, email)")
    .order("year", { ascending: false })
    .order("month", { ascending: false })
    .limit(100);

  return (
    <div>
      <h1 className="text-2xl font-semibold text-gray-900 mb-6">Payouts</h1>
      <div className="rounded-lg bg-white border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="text-left p-3">Publisher</th>
              <th className="text-left p-3">Month / Year</th>
              <th className="text-left p-3">Amount</th>
              <th className="text-left p-3">Status</th>
              <th className="text-left p-3">Paid at</th>
              <th className="text-left p-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {(payouts ?? []).map((p) => (
              <tr key={p.id} className="border-b border-gray-100">
                <td className="p-3">
                  <span className="font-medium">{(p.publishers as { name?: string })?.name}</span>
                  <br />
                  <span className="text-gray-600 text-xs">{(p.publishers as { email?: string })?.email}</span>
                </td>
                <td className="p-3">{p.month}/{p.year}</td>
                <td className="p-3"><FormattedMoney amountUsd={Number(p.amount)} /></td>
                <td className="p-3">
                  <span className={p.status === "paid" ? "text-green-600" : "text-amber-600"}>
                    {p.status}
                  </span>
                </td>
                <td className="p-3">
                  {p.paid_at
                    ? new Date(p.paid_at).toLocaleDateString()
                    : "—"}
                </td>
                <td className="p-3">
                  <PayoutActions payoutId={p.id} status={p.status} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {(!payouts || payouts.length === 0) && (
          <p className="p-4 text-gray-600">No payouts yet. Payouts are created when you generate invoices.</p>
        )}
      </div>
    </div>
  );
}
