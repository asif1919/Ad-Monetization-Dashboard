import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { GenerateInvoicesButton } from "./generate-button";
import { FormattedMoney } from "@/components/currency/formatted-money";
import { InvoicesPeriodFilter } from "./invoices-period-filter";
import { MarkPaidButton } from "./mark-paid-button";

export type InvoicePeriodRow = {
  publisher_id: string;
  publisher_name: string;
  publisher_email: string;
  invoice: {
    id: string;
    invoice_number: string;
    publisher_earnings: number;
    status: string;
    file_path: string | null;
  } | null;
  payout: {
    id: string;
    amount: number;
    status: string;
    paid_at: string | null;
  } | null;
};

function parsePeriod(searchParams: { month?: string; year?: string }) {
  const now = new Date();
  const defaultM = now.getUTCMonth() + 1;
  const defaultY = now.getUTCFullYear();
  const month = Math.min(12, Math.max(1, parseInt(searchParams.month ?? String(defaultM), 10) || defaultM));
  const year = Math.min(2035, Math.max(2020, parseInt(searchParams.year ?? String(defaultY), 10) || defaultY));
  return { month, year };
}

export default async function InvoicesPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string; year?: string }>;
}) {
  const sp = await searchParams;
  const { month, year } = parsePeriod(sp);
  const supabase = await createClient();

  const [{ data: invoiceRows }, { data: payoutRows }] = await Promise.all([
    supabase
      .from("invoices")
      .select("id, publisher_id, invoice_number, publisher_earnings, status, file_path, publishers(name, email)")
      .eq("month", month)
      .eq("year", year),
    supabase
      .from("payouts")
      .select("id, publisher_id, amount, status, paid_at")
      .eq("month", month)
      .eq("year", year),
  ]);

  const byPub = new Map<string, InvoicePeriodRow>();
  const invList = invoiceRows ?? [];
  const payList = payoutRows ?? [];

  for (const inv of invList) {
    const pub = inv.publishers as { name?: string; email?: string } | null;
    byPub.set(inv.publisher_id, {
      publisher_id: inv.publisher_id,
      publisher_name: pub?.name ?? "—",
      publisher_email: pub?.email ?? "—",
      invoice: {
        id: inv.id,
        invoice_number: inv.invoice_number,
        publisher_earnings: Number(inv.publisher_earnings),
        status: inv.status,
        file_path: inv.file_path,
      },
      payout: null,
    });
  }

  const invoicePubIds = new Set(invList.map((i) => i.publisher_id));
  const payoutOnlyIds = payList.filter((p) => !invoicePubIds.has(p.publisher_id)).map((p) => p.publisher_id);
  let payoutOnlyPubs: { id: string; name: string; email: string }[] = [];
  if (payoutOnlyIds.length > 0) {
    const { data } = await supabase.from("publishers").select("id, name, email").in("id", payoutOnlyIds);
    payoutOnlyPubs = (data ?? []) as { id: string; name: string; email: string }[];
  }
  const pubById = new Map(payoutOnlyPubs.map((p) => [p.id, p]));

  for (const p of payList) {
    const payoutPart = {
      id: p.id,
      amount: Number(p.amount),
      status: p.status,
      paid_at: p.paid_at,
    };
    const existing = byPub.get(p.publisher_id);
    if (existing) {
      existing.payout = payoutPart;
      continue;
    }
    const pub = pubById.get(p.publisher_id);
    byPub.set(p.publisher_id, {
      publisher_id: p.publisher_id,
      publisher_name: pub?.name ?? "—",
      publisher_email: pub?.email ?? "—",
      invoice: null,
      payout: payoutPart,
    });
  }

  const rows = Array.from(byPub.values()).sort((a, b) =>
    a.publisher_name.localeCompare(b.publisher_name, undefined, { sensitivity: "base" })
  );

  return (
    <div>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between mb-4">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Invoices &amp; payouts</h1>
          <p className="text-sm text-gray-600 mt-2 max-w-2xl">
            Use <strong>one</strong> month and year for the whole page. Review publishers below, then mark them paid
            after you send payment. The optional button creates <strong>missing</strong> invoice PDFs for that same
            month (see note next to it).
          </p>
        </div>
        <div className="flex flex-col gap-4 shrink-0 max-w-sm w-full lg:max-w-md">
          <Suspense
            fallback={
              <div className="h-10 w-64 rounded border border-gray-200 bg-gray-50 animate-pulse" aria-hidden />
            }
          >
            <InvoicesPeriodFilter month={month} year={year} />
          </Suspense>
          <GenerateInvoicesButton month={month} year={year} />
        </div>
      </div>

      <p className="text-sm font-medium text-gray-800 mb-3">
        Showing <span className="text-blue-700">{month}/{year}</span> · {rows.length} publisher
        {rows.length === 1 ? "" : "s"}
      </p>

      <div className="rounded-lg bg-white border border-gray-200 overflow-x-auto">
        <table className="w-full text-sm min-w-[880px]">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="text-left p-3">Publisher</th>
              <th className="text-left p-3">Email</th>
              <th className="text-left p-3">Invoice #</th>
              <th className="text-right p-3">Invoice earnings</th>
              <th className="text-right p-3">Payout amount</th>
              <th className="text-left p-3">Invoice</th>
              <th className="text-left p-3">Payout</th>
              <th className="text-left p-3">Paid at</th>
              <th className="text-right p-3">Action</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const fullyPaid =
                (!row.invoice || row.invoice.status === "paid") &&
                (!row.payout || row.payout.status === "paid");
              return (
                <tr key={row.publisher_id} className="border-b border-gray-100">
                  <td className="p-3 font-medium text-gray-900">{row.publisher_name}</td>
                  <td className="p-3 text-gray-700 max-w-[200px] truncate" title={row.publisher_email}>
                    {row.publisher_email}
                  </td>
                  <td className="p-3 font-mono text-gray-800">
                    {row.invoice ? row.invoice.invoice_number : "—"}
                  </td>
                  <td className="p-3 text-right">
                    {row.invoice ? (
                      <FormattedMoney amountUsd={row.invoice.publisher_earnings} />
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="p-3 text-right">
                    {row.payout ? <FormattedMoney amountUsd={row.payout.amount} /> : "—"}
                  </td>
                  <td className="p-3 text-gray-700">{row.invoice ? row.invoice.status : "—"}</td>
                  <td className="p-3 text-gray-700">{row.payout ? row.payout.status : "—"}</td>
                  <td className="p-3 text-gray-600 text-xs">
                    {row.payout?.paid_at ? new Date(row.payout.paid_at).toLocaleString() : "—"}
                  </td>
                  <td className="p-3 text-right">
                    <MarkPaidButton
                      publisherId={row.publisher_id}
                      month={month}
                      year={year}
                      disabled={fullyPaid}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {rows.length === 0 && (
          <p className="p-4 text-gray-600">
            No invoices or payouts for this month yet. Import traffic under Revenue &amp; Payouts, then either use
            &quot;Create missing invoices&quot; above or let publishers create their own — then mark paid when
            ready.
          </p>
        )}
      </div>
    </div>
  );
}
