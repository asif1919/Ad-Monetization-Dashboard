import type { SupabaseClient } from "@supabase/supabase-js";
import { buildInvoicePdf } from "@/lib/invoice-pdf";

/**
 * Build PDF, storage upload, invoices + payouts rows for one publisher/month
 * using only imported daily_stats (is_estimated = false).
 */
export async function generateInvoiceForPublisherMonth(
  supabase: SupabaseClient,
  publisherId: string,
  month: number,
  year: number
): Promise<{ ok: true } | { ok: false; message: string }> {
  const startDate = `${year}-${String(month).padStart(2, "0")}-01`;
  const endDate = `${year}-${String(month).padStart(2, "0")}-${String(
    new Date(year, month, 0).getDate()
  ).padStart(2, "0")}`;

  const { data: stats } = await supabase
    .from("daily_stats")
    .select("impressions, clicks, revenue")
    .eq("publisher_id", publisherId)
    .gte("stat_date", startDate)
    .lte("stat_date", endDate)
    .eq("is_estimated", false);

  let impressions = 0;
  let clicks = 0;
  let revenue = 0;
  for (const s of stats ?? []) {
    impressions += Number(s.impressions) || 0;
    clicks += Number(s.clicks) || 0;
    revenue += Number(s.revenue) || 0;
  }

  if (revenue <= 0) {
    return {
      ok: false,
      message:
        "No finalized traffic data for this month yet. You can create an invoice after your traffic report for that period is processed.",
    };
  }

  const { data: pub, error: pubErr } = await supabase
    .from("publishers")
    .select("id, name, revenue_share_pct")
    .eq("id", publisherId)
    .single();
  if (pubErr || !pub) {
    return { ok: false, message: "Could not load publisher profile." };
  }

  const sharePct = Number(pub.revenue_share_pct) || 0;
  const publisherEarnings = (revenue * sharePct) / 100;

  let invoiceSeq = 1000;
  const { data: lastInv } = await supabase
    .from("invoices")
    .select("invoice_number")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (lastInv?.invoice_number) {
    const n = parseInt(String(lastInv.invoice_number).replace(/\D/g, ""), 10);
    if (!Number.isNaN(n)) invoiceSeq = n + 1;
  }
  const invNum = `INV-${invoiceSeq}`;

  const pdfBuffer = await buildInvoicePdf({
    publisherName: pub.name,
    month,
    year,
    totalImpressions: impressions,
    totalRevenue: revenue,
    revenueSharePct: sharePct,
    publisherEarnings,
    invoiceNumber: invNum,
    status: "pending",
  });

  const path = `${publisherId}/${year}-${String(month).padStart(2, "0")}.pdf`;
  const { error: uploadError } = await supabase.storage
    .from("invoices")
    .upload(path, pdfBuffer, { contentType: "application/pdf", upsert: true });
  const filePath = uploadError ? null : path;

  const { error: invErr } = await supabase.from("invoices").upsert(
    {
      publisher_id: publisherId,
      month,
      year,
      invoice_number: invNum,
      file_path: filePath,
      total_impressions: impressions,
      total_revenue: revenue,
      revenue_share_pct: sharePct,
      publisher_earnings: publisherEarnings,
      status: "pending",
    },
    { onConflict: "publisher_id,month,year" }
  );
  if (invErr) {
    return { ok: false, message: invErr.message };
  }

  const { error: payErr } = await supabase.from("payouts").upsert(
    {
      publisher_id: publisherId,
      month,
      year,
      amount: publisherEarnings,
      status: "pending",
      updated_at: new Date().toISOString(),
    },
    { onConflict: "publisher_id,month,year" }
  );
  if (payErr) {
    return { ok: false, message: payErr.message };
  }

  return { ok: true };
}
