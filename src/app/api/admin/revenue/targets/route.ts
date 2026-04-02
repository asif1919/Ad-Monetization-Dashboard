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

  const { data: stats } = await supabase
    .from("daily_stats")
    .select("publisher_id")
    .gte("stat_date", startDate)
    .lte("stat_date", endDate);

  const hasStatsByPublisher = new Set(
    (stats ?? []).map((r) => r.publisher_id as string)
  );

  const targetByPublisher = new Map(
    (targets ?? []).map((t) => [
      t.publisher_id,
      { id: t.id, target_revenue: Number(t.target_revenue) },
    ])
  );

  const list = (publishers ?? []).map((p) => {
    const estimate_status: "none" | "generated" = hasStatsByPublisher.has(p.id)
      ? "generated"
      : "none";
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
      estimate_status,
    };
  });

  return NextResponse.json({
    targets: list,
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
