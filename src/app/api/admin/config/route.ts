import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { distributeMonthlyRevenue } from "@/lib/estimates";

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
  const { month, year, expected_revenue } = body as {
    month?: number;
    year?: number;
    expected_revenue?: number;
  };
  if (
    typeof month !== "number" ||
    month < 1 ||
    month > 12 ||
    typeof year !== "number" ||
    typeof expected_revenue !== "number" ||
    expected_revenue < 0
  ) {
    return NextResponse.json(
      { error: "Invalid month, year, or expected_revenue" },
      { status: 400 }
    );
  }

  // Upsert monthly_config
  const { data: config, error: configError } = await supabase
    .from("monthly_config")
    .upsert(
      {
        month,
        year,
        expected_revenue,
        real_data_imported_at: null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "month,year" }
    )
    .select("id")
    .single();

  if (configError) return NextResponse.json({ error: configError.message }, { status: 500 });

  // Get all active publishers with revenue share
  const { data: publishers } = await supabase
    .from("publishers")
    .select("id, revenue_share_pct")
    .eq("status", "active");

  const revenueShareByPublisher = (publishers ?? []).map((p) => ({
    publisher_id: p.id,
    revenue_share_pct: Number(p.revenue_share_pct),
  }));

  const rows = distributeMonthlyRevenue(
    expected_revenue,
    year,
    month,
    revenueShareByPublisher
  );

  // Delete existing estimated stats for this month
  const startDate = `${year}-${String(month).padStart(2, "0")}-01`;
  const endDate = `${year}-${String(month).padStart(2, "0")}-${String(new Date(year, month, 0).getDate()).padStart(2, "0")}`;
  await supabase
    .from("daily_stats")
    .delete()
    .gte("stat_date", startDate)
    .lte("stat_date", endDate)
    .eq("is_estimated", true);

  // Insert new estimated daily_stats
  const toInsert = rows.map((r) => ({
    stat_date: r.stat_date,
    publisher_id: r.publisher_id,
    domain_id: null,
    impressions: r.impressions,
    clicks: 0,
    revenue: r.revenue,
    is_estimated: true,
  }));

  if (toInsert.length > 0) {
    const { error: insertError } = await supabase
      .from("daily_stats")
      .insert(toInsert);
    if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, configId: config?.id });
}
