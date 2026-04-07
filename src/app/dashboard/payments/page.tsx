import { resolveDashboardPublisher } from "@/lib/dashboard-effective-publisher";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { InvoiceDownload } from "./invoice-download";
import { FormattedMoney } from "@/components/currency/formatted-money";
import { CreditCard, Calendar, ArrowUpRight, Clock, CheckCircle2 } from "lucide-react"; // Assuming Lucide is available

export default async function PaymentsPage() {
  const supabase = await createClient();
  const dash = await resolveDashboardPublisher(supabase);
  if (!dash.ok) redirect(dash.redirectTo);
  const { publisherId } = dash;

  const { data: payouts } = await supabase
    .from("payouts")
    .select("id, month, year, amount, status, paid_at")
    .eq("publisher_id", publisherId)
    .order("year", { ascending: false })
    .order("month", { ascending: false })
    .limit(24);

  const nextPending = payouts?.find((p) => p.status === "pending");

  return (
    <div className="max-w-5xl mx-auto py-8 px-4 sm:px-6">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Payments</h1>
        <p className="text-gray-500 mt-2">
          Manage your earnings, download tax invoices, and track payout history.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Actions & Stats */}
        <div className="lg:col-span-1 space-y-6">
          {/* Next Payout Card */}
          <div className="bg-slate-900 rounded-2xl p-6 text-white shadow-xl shadow-blue-100/20 relative overflow-hidden">
             <div className="relative z-10">
                <div className="flex items-center gap-2 text-slate-400 text-xs font-medium uppercase tracking-wider mb-4">
                    <Clock className="w-4 h-4" />
                    Upcoming Payout
                </div>
                {nextPending ? (
                    <>
                        <div className="text-3xl font-bold mb-1">
                            <FormattedMoney amountUsd={Number(nextPending.amount)} />
                        </div>
                        <p className="text-slate-400 text-sm">
                            Scheduled for {nextPending.month}/{nextPending.year}
                        </p>
                    </>
                ) : (
                    <p className="text-slate-400 text-sm">No pending payouts scheduled.</p>
                )}
             </div>
             {/* Decorative Background Element */}
             <div className="absolute -right-4 -bottom-4 opacity-10">
                <CreditCard className="w-32 h-32" />
             </div>
          </div>

          {/* Invoice Utility Card */}
          <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
            <h2 className="font-semibold text-gray-900 flex items-center gap-2 mb-4">
              <Calendar className="w-4 h-4 text-blue-600" />
              Generate Invoices
            </h2>
            <p className="text-xs text-gray-500 mb-4 leading-relaxed">
              Select a month to generate a PDF invoice based on finalized traffic data.
            </p>
            <InvoiceDownload />
          </div>
        </div>

        {/* Right Column: History Table */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center">
              <h2 className="font-semibold text-gray-900">Payment History</h2>
              <span className="text-[10px] bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full font-medium">
                LAST 24 MONTHS
              </span>
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead>
                  <tr className="text-gray-400 font-medium border-b border-gray-50">
                    <th className="px-6 py-4">Period</th>
                    <th className="px-6 py-4">Amount</th>
                    <th className="px-6 py-4">Status</th>
                    <th className="px-6 py-4 text-right">Paid Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {(payouts ?? []).map((p) => (
                    <tr key={p.id} className="hover:bg-gray-50/50 transition-colors group">
                      <td className="px-6 py-4 font-medium text-gray-900">
                        {p.month.toString().padStart(2, '0')}/{p.year}
                      </td>
                      <td className="px-6 py-4 font-semibold text-gray-900">
                        <FormattedMoney amountUsd={Number(p.amount)} />
                      </td>
                      <td className="px-6 py-4">
                        {p.status === "paid" ? (
                          <span className="inline-flex items-center gap-1.5 py-1 px-2.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-100">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            Paid
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 py-1 px-2.5 rounded-full text-xs font-medium bg-amber-50 text-amber-700 border border-amber-100">
                            <Clock className="w-3.5 h-3.5" />
                            Pending
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right text-gray-500">
                        {p.paid_at ? (
                          <span className="flex items-center justify-end gap-1">
                            {new Date(p.paid_at).toLocaleDateString(undefined, { dateStyle: 'medium' })}
                            <ArrowUpRight className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                          </span>
                        ) : (
                          "—"
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              
              {(!payouts || payouts.length === 0) && (
                <div className="py-12 text-center">
                  <p className="text-gray-400 italic">No payment history found.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}