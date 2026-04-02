import { createClient } from "@/lib/supabase/server";
import {
  buildPublisherMonthsWithDailyStats,
  invoiceMatchesDailyStatsMonth,
  monthKey,
} from "@/lib/invoice-real-months";
import { currentAndPreviousCalendarMonthUtc } from "@/lib/invoice-month-window";
import { NextResponse } from "next/server";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles")
    .select("publisher_id")
    .eq("id", user.id)
    .single();
  const publisherId = profile?.publisher_id;
  if (!publisherId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { data: invoices } = await supabase
    .from("invoices")
    .select("id, month, year, file_path")
    .eq("publisher_id", publisherId)
    .order("year", { ascending: false })
    .order("month", { ascending: false });

  const { data: statRows } = await supabase
    .from("daily_stats")
    .select("publisher_id, stat_date")
    .eq("publisher_id", publisherId);

  const monthsByPublisher = buildPublisherMonthsWithDailyStats(
    (statRows ?? []) as { publisher_id: string; stat_date: string }[]
  );

  const filtered = (invoices ?? []).filter((inv) =>
    invoiceMatchesDailyStatsMonth(
      {
        publisher_id: publisherId,
        year: inv.year as number,
        month: inv.month as number,
      },
      monthsByPublisher
    )
  );

  const months = monthsByPublisher.get(publisherId) ?? new Set<string>();
  const eligibilityByMonthKey: Record<string, boolean> = {};
  for (const { year, month } of currentAndPreviousCalendarMonthUtc()) {
    eligibilityByMonthKey[monthKey(year, month)] = months.has(monthKey(year, month));
  }

  return NextResponse.json({ invoices: filtered, eligibilityByMonthKey });
}
