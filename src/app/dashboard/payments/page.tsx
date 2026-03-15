import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { InvoiceDownload } from "./invoice-download";

export default async function PaymentsPage() {
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

  const { data: payouts } = await supabase
    .from("payouts")
    .select("id, month, year, amount, status, paid_at")
    .eq("publisher_id", publisherId)
    .order("year", { ascending: false })
    .order("month", { ascending: false })
    .limit(24);

  const nextPending = payouts?.find((p) => p.status === "pending");

  return (
    <div>
      <h1 className="text-2xl font-semibold text-gray-900 mb-6">Payments</h1>
      {nextPending && (
        <div className="rounded-lg bg-blue-50 border border-blue-200 p-4 mb-6">
          <p className="text-sm text-blue-800">
            Next payout: {nextPending.month}/{nextPending.year} — $
            {Number(nextPending.amount).toFixed(2)} (pending)
          </p>
        </div>
      )}
      <div className="rounded-lg bg-white border border-gray-200 overflow-hidden">
        <h2 className="px-4 py-3 font-medium border-b border-gray-200">
          Payment history
        </h2>
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="text-left p-3">Month / Year</th>
              <th className="text-left p-3">Amount</th>
              <th className="text-left p-3">Status</th>
              <th className="text-left p-3">Paid at</th>
            </tr>
          </thead>
          <tbody>
            {(payouts ?? []).map((p) => (
              <tr key={p.id} className="border-b border-gray-100">
                <td className="p-3">{p.month}/{p.year}</td>
                <td className="p-3">${Number(p.amount).toFixed(2)}</td>
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
              </tr>
            ))}
          </tbody>
        </table>
        {(!payouts || payouts.length === 0) && (
          <p className="p-4 text-gray-600">No payment history yet.</p>
        )}
      </div>
      <div className="mt-8">
        <h2 className="font-medium text-gray-900 mb-3">Download invoices (PDF)</h2>
        <InvoiceDownload publisherId={publisherId} />
      </div>
    </div>
  );
}
