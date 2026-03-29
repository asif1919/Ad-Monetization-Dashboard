import { createClient } from "@/lib/supabase/server";
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
  if (profile?.role !== "super_admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const { publisher_id, month, year } = body as {
    publisher_id?: string;
    month?: number;
    year?: number;
  };
  if (!publisher_id || typeof month !== "number" || month < 1 || month > 12 || typeof year !== "number") {
    return NextResponse.json({ error: "publisher_id, month, and year are required" }, { status: 400 });
  }

  const paidAt = new Date().toISOString();

  const { error: invErr } = await supabase
    .from("invoices")
    .update({ status: "paid" })
    .eq("publisher_id", publisher_id)
    .eq("month", month)
    .eq("year", year);

  if (invErr) return NextResponse.json({ error: invErr.message }, { status: 500 });

  const { error: payErr } = await supabase
    .from("payouts")
    .update({ status: "paid", paid_at: paidAt, updated_at: paidAt })
    .eq("publisher_id", publisher_id)
    .eq("month", month)
    .eq("year", year);

  if (payErr) return NextResponse.json({ error: payErr.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
