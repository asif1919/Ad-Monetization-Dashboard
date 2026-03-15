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
  if (profile?.role !== "super_admin")
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await request.json();
  const { name, email, revenue_share_pct, status } = body as {
    name?: string;
    email?: string;
    revenue_share_pct?: number;
    status?: string;
  };
  if (!name || !email)
    return NextResponse.json(
      { error: "Name and email required" },
      { status: 400 }
    );

  const share = Number(revenue_share_pct);
  if (Number.isNaN(share) || share < 0 || share > 100)
    return NextResponse.json(
      { error: "Revenue share must be 0–100" },
      { status: 400 }
    );

  const { data, error } = await supabase
    .from("publishers")
    .insert({
      name,
      email,
      revenue_share_pct: share,
      status: status === "suspended" ? "suspended" : "active",
    })
    .select("id")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ id: data.id });
}
