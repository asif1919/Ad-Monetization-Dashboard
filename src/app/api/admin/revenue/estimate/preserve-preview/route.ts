import { createClient } from "@/lib/supabase/server";
import { getFrozenPrefixStatBounds } from "@/lib/estimate-partial";
import { NextResponse } from "next/server";

/**
 * Frozen-window revenue sum + day bounds for a given preserve_first_n_days (matches estimate run).
 */
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
  const publisher_id = searchParams.get("publisher_id");
  const month = Number(searchParams.get("month"));
  const year = Number(searchParams.get("year"));
  const preserve_n = Number(searchParams.get("preserve_first_n_days"));

  if (
    !publisher_id ||
    !Number.isFinite(month) ||
    month < 1 ||
    month > 12 ||
    !Number.isFinite(year) ||
    !Number.isFinite(preserve_n) ||
    preserve_n < 1
  ) {
    return NextResponse.json(
      { error: "publisher_id, month, year, and preserve_first_n_days are required" },
      { status: 400 }
    );
  }

  const { data: pub } = await supabase
    .from("publishers")
    .select("created_at")
    .eq("id", publisher_id)
    .maybeSingle();

  const bounds = getFrozenPrefixStatBounds(
    year,
    month,
    pub?.created_at as string | undefined,
    preserve_n
  );
  if (!bounds.ok) {
    return NextResponse.json(
      { ok: false, error: bounds.error, code: bounds.code },
      { status: 400 }
    );
  }

  const { data: frozenRows, error: frozenErr } = await supabase
    .from("daily_stats")
    .select("revenue")
    .eq("publisher_id", publisher_id)
    .gte("stat_date", bounds.frozenStartStatDate)
    .lte("stat_date", bounds.frozenEndStatDate);

  if (frozenErr) {
    return NextResponse.json({ error: frozenErr.message }, { status: 500 });
  }

  const frozenSum = (frozenRows ?? []).reduce(
    (s, row) => s + Number((row as { revenue: unknown }).revenue ?? 0),
    0
  );

  const body = {
    ok: true as const,
    frozenSum,
    frozenStartDay: bounds.frozenStartDay,
    frozenEndDay: bounds.frozenEndDay,
    tailStartDay: bounds.tailStartDay,
    tailEndDay: bounds.tailEndDay,
    rowCount: frozenRows?.length ?? 0,
    preserve_first_n_days: preserve_n,
  };

  console.log("[api/preserve-preview]", {
    month,
    year,
    publisher_id: `${publisher_id.slice(0, 8)}…`,
    ...body,
  });

  return NextResponse.json(body);
}
