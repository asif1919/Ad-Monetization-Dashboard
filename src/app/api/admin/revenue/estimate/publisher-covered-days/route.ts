import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

/**
 * Latest calendar day-of-month that has a daily_stats row for this publisher in the month.
 * Used to prefill "preserve first N days" from existing estimates.
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

  if (!publisher_id || !Number.isFinite(month) || month < 1 || month > 12 || !Number.isFinite(year)) {
    return NextResponse.json(
      { error: "publisher_id, month, and year are required" },
      { status: 400 }
    );
  }

  const startDate = `${year}-${String(month).padStart(2, "0")}-01`;
  const endDate = `${year}-${String(month).padStart(2, "0")}-${String(
    new Date(year, month, 0).getDate()
  ).padStart(2, "0")}`;

  const { data: rows, error } = await supabase
    .from("daily_stats")
    .select("stat_date")
    .eq("publisher_id", publisher_id)
    .gte("stat_date", startDate)
    .lte("stat_date", endDate);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const daysInMonth = new Date(year, month, 0).getDate();

  let maxDay: number | null = null;
  for (const r of rows ?? []) {
    const d = String((r as { stat_date: string }).stat_date).slice(0, 10);
    const parts = d.split("-");
    if (parts.length !== 3) continue;
    const day = parseInt(parts[2]!, 10);
    if (!Number.isFinite(day)) continue;
    if (maxDay === null || day > maxDay) maxDay = day;
  }

  const payload = {
    maxDay,
    rowCount: rows?.length ?? 0,
    daysInMonth,
    /** True when latest stat day is the last calendar day — client may default N to dim-1 for partial regen */
    coversFullMonth: maxDay != null && maxDay >= daysInMonth,
  };

  console.log("[api/publisher-covered-days]", {
    month,
    year,
    publisher_id: `${publisher_id.slice(0, 8)}…`,
    ...payload,
  });

  return NextResponse.json(payload);
}
