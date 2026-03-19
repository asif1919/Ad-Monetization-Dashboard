import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
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

  const { searchParams } = new URL(request.url);
  const month = searchParams.get("month");
  const year = searchParams.get("year");
  if (!month || !year) {
    return NextResponse.json({ error: "month and year required" }, { status: 400 });
  }
  const monthNum = parseInt(month, 10);
  const yearNum = parseInt(year, 10);
  if (monthNum < 1 || monthNum > 12 || !Number.isFinite(yearNum)) {
    return NextResponse.json({ error: "Invalid month or year" }, { status: 400 });
  }

  const startDate = `${yearNum}-${String(monthNum).padStart(2, "0")}-01`;
  const endDate = `${yearNum}-${String(monthNum).padStart(2, "0")}-${String(
    new Date(yearNum, monthNum, 0).getDate()
  ).padStart(2, "0")}`;

  const { data: publishers } = await supabase
    .from("publishers")
    .select("id, name, email, public_id, status, created_at")
    .order("name");

  const { data: targets } = await supabase
    .from("publisher_monthly_targets")
    .select("id, publisher_id, target_revenue")
    .eq("month", monthNum)
    .eq("year", yearNum);

  const { data: monthlyConfig } = await supabase
    .from("monthly_config")
    .select("real_data_imported_at")
    .eq("month", monthNum)
    .eq("year", yearNum)
    .maybeSingle();

  const { data: stats } = await supabase
    .from("daily_stats")
    .select("publisher_id, is_estimated")
    .gte("stat_date", startDate)
    .lte("stat_date", endDate);

  const { data: logs } = await supabase
    .from("import_logs")
    .select("unmatched_data, errors, created_at")
    .gte("created_at", startDate)
    .lte("created_at", endDate);

  const targetByPublisher = new Map(
    (targets ?? []).map((t) => [
      t.publisher_id,
      { id: t.id, target_revenue: Number(t.target_revenue) },
    ])
  );

  const estimateStatusByPublisher = new Map<string, "none" | "generated" | "skipped_real_data">();
  for (const row of stats ?? []) {
    const pid = row.publisher_id as string;
    const isEstimated = row.is_estimated as boolean;
    const current = estimateStatusByPublisher.get(pid);
    if (isEstimated) {
      if (!current) estimateStatusByPublisher.set(pid, "generated");
    } else {
      estimateStatusByPublisher.set(pid, "skipped_real_data");
    }
  }

  type UploadStatus = "pending" | "uploaded" | "failed";
  const uploadStatusByPublisher = new Map<string, UploadStatus>();
  for (const log of logs ?? []) {
    const createdAt = new Date(log.created_at as string | number | Date);
    const entries = ([] as any[]).concat(log.unmatched_data ?? [], log.errors ?? []);
    for (const entry of entries) {
      if (
        entry &&
        typeof entry === "object" &&
        "publisher_id" in entry &&
        "month" in entry &&
        "year" in entry &&
        entry.month === monthNum &&
        entry.year === yearNum
      ) {
        const pid = String(entry.publisher_id);
        const status = entry.status as UploadStatus | undefined;
        if (!status) continue;
        const prev = uploadStatusByPublisher.get(pid);
        if (!prev || createdAt > new Date()) {
          uploadStatusByPublisher.set(pid, status);
        }
      }
    }
  }

  const list = (publishers ?? []).map((p) => {
    const baseStatus: UploadStatus = "pending";
    const upload_status = uploadStatusByPublisher.get(p.id) ?? baseStatus;
    const estimate_status = estimateStatusByPublisher.get(p.id) ?? "none";
    const target = targetByPublisher.get(p.id);
    return {
      publisher_id: p.id,
      name: p.name,
      email: p.email,
      public_id: p.public_id ?? null,
      created_at: p.created_at as string,
      is_active: p.status === "active",
      target_revenue: target?.target_revenue ?? 0,
      target_id: target?.id ?? null,
      upload_status,
      estimate_status,
    };
  });

  return NextResponse.json({
    targets: list,
    real_data_imported_at: monthlyConfig?.real_data_imported_at ?? null,
  });
}

export async function PUT(request: Request) {
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
  const { month, year, publisher_id, target_revenue } = body as {
    month?: number;
    year?: number;
    publisher_id?: string;
    target_revenue?: number;
  };
  if (
    typeof month !== "number" ||
    month < 1 ||
    month > 12 ||
    typeof year !== "number" ||
    typeof publisher_id !== "string" ||
    !publisher_id ||
    typeof target_revenue !== "number" ||
    target_revenue < 0
  ) {
    return NextResponse.json(
      { error: "Invalid month, year, publisher_id, or target_revenue" },
      { status: 400 }
    );
  }

  const { error } = await supabase
    .from("publisher_monthly_targets")
    .upsert(
      {
        publisher_id,
        month,
        year,
        target_revenue,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "publisher_id,month,year" }
    );

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
