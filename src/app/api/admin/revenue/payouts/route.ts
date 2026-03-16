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

  const { data: payouts } = await supabase
    .from("payouts")
    .select("id, publisher_id, month, year, amount, status, paid_at, publishers(name, email)")
    .eq("month", monthNum)
    .eq("year", yearNum)
    .order("publishers(name)");

  const list = (payouts ?? []).map((p) => ({
    id: p.id,
    publisher_id: p.publisher_id,
    publisher_name: (p.publishers as { name?: string })?.name ?? "",
    publisher_email: (p.publishers as { email?: string })?.email ?? "",
    month: p.month,
    year: p.year,
    amount: Number(p.amount),
    status: p.status,
    paid_at: p.paid_at,
  }));

  return NextResponse.json({ payouts: list });
}

export async function PATCH(request: Request) {
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
  const { payout_id, status } = body as { payout_id?: string; status?: string };
  if (!payout_id || status !== "paid") {
    return NextResponse.json({ error: "payout_id and status: 'paid' required" }, { status: 400 });
  }

  const { error } = await supabase
    .from("payouts")
    .update({
      status: "paid",
      paid_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", payout_id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
