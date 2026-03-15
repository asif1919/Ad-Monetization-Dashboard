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

  const { data: configs } = await supabase
    .from("monthly_config")
    .select("month, year")
    .not("real_data_imported_at", "is", null)
    .order("year", { ascending: false })
    .order("month", { ascending: false })
    .limit(24);

  return NextResponse.json({
    months: (configs ?? []).map((c) => ({ month: c.month, year: c.year })),
  });
}
