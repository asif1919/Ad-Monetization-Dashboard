import { createClient } from "@/lib/supabase/server";
import { generateInvoiceForPublisherMonth } from "@/lib/generate-invoice-for-publisher";
import { NextResponse } from "next/server";

type SkippedPublisher = {
  publisher_id: string;
  name: string | null;
  reason: string;
};

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

  const { data: allRows } = await supabase
    .from("daily_stats")
    .select("publisher_id")
    .gte("stat_date", startDate)
    .lte("stat_date", endDate);

  const publishersWithAnyStats = new Set<string>();
  for (const r of allRows ?? []) {
    const pid = r.publisher_id as string;
    if (pid) publishersWithAnyStats.add(pid);
  }

  const { data: stats } = await supabase
    .from("daily_stats")
    .select("publisher_id, impressions, clicks, revenue")
    .gte("stat_date", startDate)
    .lte("stat_date", endDate)
    .eq("is_estimated", false);

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

  const eligibleIds = [...byPublisher.keys()].filter((id) => (byPublisher.get(id)?.revenue ?? 0) > 0);

  const { data: publishers } =
    eligibleIds.length > 0
      ? await supabase
          .from("publishers")
          .select("id, name, revenue_share_pct")
          .in("id", eligibleIds)
      : { data: [] as { id: string; name: string; revenue_share_pct: number }[] };

  const generatedIds = new Set<string>();
  let generated = 0;

  for (const p of publishers ?? []) {
    const tot = byPublisher.get(p.id);
    if (!tot || tot.revenue <= 0) continue;
    const result = await generateInvoiceForPublisherMonth(supabase, p.id, month, year);
    if (result.ok) {
      generatedIds.add(p.id);
      generated++;
    }
  }

  const skippedIds = [...publishersWithAnyStats].filter((id) => !generatedIds.has(id));
  let skipped: SkippedPublisher[] = [];
  if (skippedIds.length > 0) {
    const { data: skippedPubs } = await supabase
      .from("publishers")
      .select("id, name")
      .in("id", skippedIds);
    const nameById = new Map((skippedPubs ?? []).map((r) => [r.id as string, r.name as string | null]));
    skipped = skippedIds.map((publisher_id) => ({
      publisher_id,
      name: nameById.get(publisher_id) ?? null,
      reason:
        "No imported daily stats for this month (invoices use imported report totals only, not projections).",
    }));
  }

  return NextResponse.json({ ok: true, generated, skipped });
}
