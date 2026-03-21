import { createClient } from "@/lib/supabase/server";
import {
  validatePublisherUploadRows,
  type RevenueUploadInputRow,
} from "@/lib/revenue-upload";
import { logUploadReport } from "@/lib/upload-report-debug";
import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

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
  const {
    mode = "commit",
    month,
    year,
    publisher_id,
    publisher_public_id,
    rows,
  } = body as {
    mode?: "preview" | "commit";
    month?: number;
    year?: number;
    publisher_id?: string;
    publisher_public_id?: string;
    rows?: RevenueUploadInputRow[];
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

  if (mode !== "preview" && mode !== "commit") {
    return NextResponse.json({ error: "Invalid mode" }, { status: 400 });
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
      {
        error:
          "publisher_id or publisher_public_id is required and must resolve to a publisher",
      },
      { status: 400 }
    );
  }

  const { data: pubMeta } = await supabase
    .from("publishers")
    .select("id, public_id")
    .eq("id", resolvedPublisherId)
    .maybeSingle();

  const validation = validatePublisherUploadRows(
    month,
    year,
    rows,
    pubMeta?.public_id ?? null,
    pubMeta?.id ?? resolvedPublisherId
  );

  logUploadReport("api", {
    mode,
    month,
    year,
    publisherId: resolvedPublisherId,
    rowCountInBody: rows.length,
    ok: validation.ok,
    cleanedRows: validation.cleanedRows.length,
    dailyPreviewOut: validation.daily_preview.length,
    hasDerived: !!validation.derived,
    errorCount: validation.errors.length,
    warningCount: validation.warnings.length,
  });

  if (mode === "preview") {
    return NextResponse.json({
      ok: validation.ok,
      errors: validation.errors,
      warnings: validation.warnings,
      stats: validation.stats,
      cleanedRowsCount: validation.cleanedRows.length,
      derived: validation.derived,
      daily_preview: validation.daily_preview,
    });
  }

  // commit
  if (!validation.ok || validation.cleanedRows.length === 0) {
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
      errors: validation.errors,
    });
    return NextResponse.json(
      {
        status: "declined",
        total: rows.length,
        imported: 0,
        errors: validation.errors,
        warnings: validation.warnings,
      },
      { status: 400 }
    );
  }

  const cleanedRows = validation.cleanedRows;
  const endDate = new Date(year, month, 0);
  const startStr = `${year}-${String(month).padStart(2, "0")}-01`;
  const endStr = `${year}-${String(month).padStart(2, "0")}-${String(
    endDate.getDate()
  ).padStart(2, "0")}`;

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
    const errMsg = insertError.message;
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
      errors: [errMsg],
    });
    return NextResponse.json(
      {
        status: "declined",
        total: rows.length,
        imported: 0,
        errors: [errMsg],
      },
      { status: 500 }
    );
  }

  // Ensure rows are marked real (some clients/defaults can leave is_estimated = true).
  const { error: patchError } = await supabase
    .from("daily_stats")
    .update({ is_estimated: false })
    .eq("publisher_id", resolvedPublisherId)
    .gte("stat_date", startStr)
    .lte("stat_date", endStr);
  if (patchError) {
    console.error("[revenue/upload] is_estimated patch failed", patchError);
  }

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/reports");

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
    warnings: validation.warnings,
    derived: validation.derived,
    daily_preview: validation.daily_preview,
  });
}
