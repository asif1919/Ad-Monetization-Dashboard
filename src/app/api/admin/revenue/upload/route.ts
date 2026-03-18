import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

type Row = {
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
  const { month, year, publisher_id, publisher_public_id, rows } = body as {
    month?: number;
    year?: number;
    publisher_id?: string;
    publisher_public_id?: string;
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

  let resolvedPublisherId: string | null = null;
  if (publisher_id) {
    resolvedPublisherId = publisher_id;
  } else if (publisher_public_id) {
    const { data: pub } = await supabase
      .from("publishers")
      .select("id")
      .eq("public_id", publisher_public_id)
      .maybeSingle();
    resolvedPublisherId = pub?.id ?? null;
  }

  if (!resolvedPublisherId) {
    return NextResponse.json(
      { error: "publisher_id or publisher_public_id is required and must resolve to a publisher" },
      { status: 400 }
    );
  }

  const errors: string[] = [];
  const cleanedRows: {
    stat_date: string;
    impressions: number;
    clicks: number;
    revenue: number;
  }[] = [];

  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 0);

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const idx = i + 1;
    if (!r || typeof r.date !== "string" || !r.date) {
      errors.push(`Row ${idx}: missing date`);
      continue;
    }
    const d = new Date(r.date);
    if (Number.isNaN(d.getTime())) {
      errors.push(`Row ${idx}: invalid date '${r.date}'`);
      continue;
    }
    if (d < startDate || d > endDate) {
      errors.push(`Row ${idx}: date ${r.date} not in selected month`);
      continue;
    }
    const impressions = Number(r.impressions);
    const clicks = Number(r.clicks);
    const revenue = Number(r.revenue);
    if (impressions < 0 || clicks < 0 || revenue < 0) {
      errors.push(`Row ${idx}: negative impressions, clicks, or revenue`);
      continue;
    }
    cleanedRows.push({
      stat_date: d.toISOString().slice(0, 10),
      impressions: impressions || 0,
      clicks: clicks || 0,
      revenue: revenue || 0,
    });
  }

  if (errors.length > 0 || cleanedRows.length === 0) {
    await supabase.from("import_logs").insert({
      uploaded_by: user.id,
      file_name: "publisher_upload",
      total_rows: rows.length,
      imported_rows: 0,
      unmatched_data: [
        {
          publisher_id: resolvedPublisherId,
          month,
          year,
          status: "failed",
        },
      ],
      errors,
    });
    return NextResponse.json(
      {
        status: "declined",
        total: rows.length,
        imported: 0,
        errors,
      },
      { status: 400 }
    );
  }

  const startStr = `${year}-${String(month).padStart(2, "0")}-01`;
  const endStr = `${year}-${String(month).padStart(
    2,
    "0"
  )}-${String(endDate.getDate()).padStart(2, "0")}`;

  // For this publisher and month we first remove any existing rows, then insert
  // only the dates present in cleanedRows. We never generate placeholder rows
  // for missing dates; reports will show only the dates that were uploaded.
  await supabase
    .from("daily_stats")
    .delete()
    .eq("publisher_id", resolvedPublisherId)
    .gte("stat_date", startStr)
    .lte("stat_date", endStr);

  const toInsert = cleanedRows.map((r) => ({
    stat_date: r.stat_date,
    publisher_id: resolvedPublisherId,
    impressions: r.impressions,
    clicks: r.clicks,
    revenue: r.revenue,
    is_estimated: false,
  }));

  const { error: insertError } = await supabase.from("daily_stats").insert(toInsert);
  if (insertError) {
    errors.push(insertError.message);
    await supabase.from("import_logs").insert({
      uploaded_by: user.id,
      file_name: "publisher_upload",
      total_rows: rows.length,
      imported_rows: 0,
      unmatched_data: [
        {
          publisher_id: resolvedPublisherId,
          month,
          year,
          status: "failed",
        },
      ],
      errors,
    });
    return NextResponse.json(
      {
        status: "declined",
        total: rows.length,
        imported: 0,
        errors,
      },
      { status: 500 }
    );
  }

  const ts = new Date().toISOString();
  const { data: existing } = await supabase
    .from("monthly_config")
    .select("id")
    .eq("month", month)
    .eq("year", year)
    .maybeSingle();

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

  await supabase.from("import_logs").insert({
    uploaded_by: user.id,
    file_name: "publisher_upload",
    total_rows: rows.length,
    imported_rows: cleanedRows.length,
    unmatched_data: [
      {
        publisher_id: resolvedPublisherId,
        month,
        year,
        status: "uploaded",
      },
    ],
    errors: [],
  });

  return NextResponse.json({
    status: "accepted",
    total: rows.length,
    imported: cleanedRows.length,
    errors: [],
  });
}

