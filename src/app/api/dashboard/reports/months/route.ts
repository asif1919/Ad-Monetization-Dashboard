import { createClient } from "@/lib/supabase/server";
import { requireDashboardPublisherForApi } from "@/lib/dashboard-effective-publisher";
import { NextResponse } from "next/server";

export async function GET() {
  const supabase = await createClient();
  const scope = await requireDashboardPublisherForApi(supabase);
  if ("response" in scope) return scope.response;
  const { publisherId } = scope;

  const { data: rows } = await supabase
    .from("daily_stats")
    .select("stat_date")
    .eq("publisher_id", publisherId)
    .order("stat_date", { ascending: false });

  const ymSet = new Set<string>();
  for (const r of rows ?? []) {
    const d = String((r as { stat_date: string }).stat_date).slice(0, 10);
    if (d.length >= 7) ymSet.add(d.slice(0, 7));
  }

  const months = [...ymSet]
    .sort((a, b) => b.localeCompare(a))
    .slice(0, 24)
    .map((ym) => {
      const [y, m] = ym.split("-").map(Number);
      return { year: y, month: m };
    });

  return NextResponse.json({ months });
}
