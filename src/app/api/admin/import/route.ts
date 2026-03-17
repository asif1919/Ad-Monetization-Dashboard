import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

type Row = {
  publisher_id?: string;
  publisher_email?: string;
  publisher_public_id?: string;
  date: string | null;
  impressions: number;
  clicks: number;
  revenue: number;
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
  const { month, year, rows } = body as {
    month?: number;
    year?: number;
    rows?: Row[];
  };
  if (
    typeof month !== "number" ||
    month < 1 ||
    month > 12 ||
    typeof year !== "number" ||
    !Array.isArray(rows)
  ) {
    return NextResponse.json(
      { error: "Invalid month, year, or rows" },
      { status: 400 }
    );
  }

  // Resolve publisher_id for each row (by email or id)
  const { data: publishers } = await supabase
    .from("publishers")
    .select("id, email, public_id");

  const byEmail = new Map<string, string>();
  const byPublicId = new Map<string, string>();
  publishers?.forEach((p) => {
    if (p.email) byEmail.set(p.email.toLowerCase(), p.id);
    if (p.public_id) byPublicId.set(String(p.public_id), p.id);
  });

  const unmatched: string[] = [];
  const errors: string[] = [];
  const toInsert: {
    stat_date: string;
    publisher_id: string;
    impressions: number;
    clicks: number;
    revenue: number;
    is_estimated: boolean;
  }[] = [];
  let imported = 0;

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    if (!r || typeof r.date !== "string" || !r.date) {
      errors.push(`Row ${i + 1}: missing date`);
      continue;
    }
    let publisherId: string | null = null;
    if (r.publisher_id) {
      const p = publishers?.find((x) => x.id === r.publisher_id);
      if (p) publisherId = p.id;
    }
    if (!publisherId && r.publisher_public_id) {
      publisherId = byPublicId.get(r.publisher_public_id.trim()) ?? null;
    }
    if (!publisherId && r.publisher_email) {
      publisherId = byEmail.get(r.publisher_email.toLowerCase().trim()) ?? null;
    }
    if (!publisherId) {
      unmatched.push(
        r.publisher_public_id ??
          r.publisher_email ??
          r.publisher_id ??
          `row ${i + 1}`
      );
      continue;
    }
    const statDate = r.date.slice(0, 10);
    toInsert.push({
      stat_date: statDate,
      publisher_id: publisherId,
      impressions: Number(r.impressions) || 0,
      clicks: Number(r.clicks) || 0,
      revenue: Number(r.revenue) || 0,
      is_estimated: false,
    });
    imported++;
  }

  const startDate = `${year}-${String(month).padStart(2, "0")}-01`;
  const endDate = `${year}-${String(month).padStart(2, "0")}-${String(new Date(year, month, 0).getDate()).padStart(2, "0")}`;

  // Delete existing stats (estimated and real) for this month for affected publishers
  const publisherIds = [...new Set(toInsert.map((x) => x.publisher_id))];
  for (const pid of publisherIds) {
    await supabase
      .from("daily_stats")
      .delete()
      .eq("publisher_id", pid)
      .gte("stat_date", startDate)
      .lte("stat_date", endDate);
  }

  if (toInsert.length > 0) {
    const { error: insertError } = await supabase
      .from("daily_stats")
      .insert(toInsert);
    if (insertError) {
      errors.push(insertError.message);
    }
  }

  // Set real_data_imported_at for this month
  const ts = new Date().toISOString();
  const { data: existing } = await supabase
    .from("monthly_config")
    .select("id")
    .eq("month", month)
    .eq("year", year)
    .single();
  if (existing) {
    await supabase
      .from("monthly_config")
      .update({ real_data_imported_at: ts, updated_at: ts })
      .eq("id", existing.id);
  } else {
    await supabase.from("monthly_config").insert({
      month,
      year,
      expected_revenue: 0,
      real_data_imported_at: ts,
    });
  }

  // Log import
  await supabase.from("import_logs").insert({
    uploaded_by: user.id,
    file_name: "upload",
    total_rows: rows.length,
    imported_rows: imported,
    unmatched_data: unmatched,
    errors,
  });

  return NextResponse.json({
    total: rows.length,
    imported,
    unmatched: [...new Set(unmatched)],
    errors,
  });
}
