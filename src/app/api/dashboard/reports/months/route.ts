import { createClient } from "@/lib/supabase/server";
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
