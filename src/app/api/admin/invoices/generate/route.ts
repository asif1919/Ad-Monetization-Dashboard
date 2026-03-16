import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { buildInvoicePdf } from "@/lib/invoice-pdf";

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (profile?.role !== "super_admin")
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await request.json();
  const { month, year } = body as { month?: number; year?: number };
  if (typeof month !== "number" || month < 1 || month > 12 || typeof year !== "number")
    return NextResponse.json({ error: "Invalid month or year" }, { status: 400 });

  const startDate = `${year}-${String(month).padStart(2, "0")}-01`;
  const endDate = `${year}-${String(month).padStart(2, "0")}-${String(new Date(year, month, 0).getDate()).padStart(2, "0")}`;

  const { data: stats } = await supabase
    .from("daily_stats")
    .select("publisher_id, impressions, clicks, revenue")
    .gte("stat_date", startDate)
    .lte("stat_date", endDate);

  const byPublisher = new Map<
    string,
    { impressions: number; clicks: number; revenue: number }
  >();
  for (const s of stats ?? []) {
    const cur = byPublisher.get(s.publisher_id) ?? {
      impressions: 0,
      clicks: 0,
      revenue: 0,
    };
    cur.impressions += Number(s.impressions) || 0;
    cur.clicks += Number(s.clicks) || 0;
    cur.revenue += Number(s.revenue) || 0;
    byPublisher.set(s.publisher_id, cur);
  }

  const { data: publishers } = await supabase
    .from("publishers")
    .select("id, name, revenue_share_pct")
    .in("id", [...byPublisher.keys()]);

  let invoiceNumber = 1000;
  const { data: lastInv } = await supabase
    .from("invoices")
    .select("invoice_number")
    .order("created_at", { ascending: false })
    .limit(1)
    .single();
  if (lastInv?.invoice_number) {
    const n = parseInt(String(lastInv.invoice_number).replace(/\D/g, ""), 10);
    if (!Number.isNaN(n)) invoiceNumber = n + 1;
  }

  for (const p of publishers ?? []) {
    const tot = byPublisher.get(p.id);
    if (!tot || tot.revenue <= 0) continue;
    const sharePct = Number(p.revenue_share_pct) || 0;
    const publisherEarnings = (tot.revenue * sharePct) / 100;
    const invNum = `INV-${invoiceNumber++}`;
    const pdfBuffer = await buildInvoicePdf({
      publisherName: p.name,
      month,
      year,
      totalImpressions: tot.impressions,
      totalRevenue: tot.revenue,
      revenueSharePct: sharePct,
      publisherEarnings,
      invoiceNumber: invNum,
      status: "pending",
    });
    const path = `${p.id}/${year}-${String(month).padStart(2, "0")}.pdf`;
    const { error: uploadError } = await supabase.storage
      .from("invoices")
      .upload(path, pdfBuffer, { contentType: "application/pdf", upsert: true });
    const filePath = uploadError ? null : path;
    await supabase.from("invoices").upsert(
      {
        publisher_id: p.id,
        month,
        year,
        invoice_number: invNum,
        file_path: filePath,
        total_impressions: tot.impressions,
        total_revenue: tot.revenue,
        revenue_share_pct: sharePct,
        publisher_earnings: publisherEarnings,
        status: "pending",
      },
      { onConflict: "publisher_id,month,year" }
    );
    await supabase.from("payouts").upsert(
      {
        publisher_id: p.id,
        month,
        year,
        amount: publisherEarnings,
        status: "pending",
        updated_at: new Date().toISOString(),
      },
      { onConflict: "publisher_id,month,year" }
    );
  }

  return NextResponse.json({ ok: true });
}
