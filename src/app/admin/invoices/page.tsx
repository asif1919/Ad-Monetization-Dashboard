import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { GenerateButton } from "./generate-button";
import { FormattedMoney } from "@/components/currency/formatted-money";

export default async function InvoicesPage() {
  const supabase = await createClient();
  const { data: invoices } = await supabase
    .from("invoices")
    .select("id, publisher_id, month, year, invoice_number, publisher_earnings, status, publishers(name)")
    .order("year", { ascending: false })
    .order("month", { ascending: false })
    .limit(100);

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-semibold text-gray-900">Invoices</h1>
        <GenerateButton />
      </div>
      <div className="rounded-lg bg-white border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="text-left p-3">Invoice #</th>
              <th className="text-left p-3">Publisher</th>
              <th className="text-left p-3">Month / Year</th>
              <th className="text-left p-3">Earnings</th>
              <th className="text-left p-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {(invoices ?? []).map((inv) => (
              <tr key={inv.id} className="border-b border-gray-100">
                <td className="p-3 font-mono">{inv.invoice_number}</td>
                <td className="p-3">{(inv.publishers as { name?: string })?.name}</td>
                <td className="p-3">{inv.month}/{inv.year}</td>
                <td className="p-3"><FormattedMoney amountUsd={Number(inv.publisher_earnings)} /></td>
                <td className="p-3">{inv.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {(!invoices || invoices.length === 0) && (
          <p className="p-4 text-gray-600">No invoices yet. Generate invoices for a month after importing real data.</p>
        )}
      </div>
    </div>
  );
}
