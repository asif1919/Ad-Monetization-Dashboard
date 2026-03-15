import { createClient } from "@/lib/supabase/server";
import { createServerAdminClient } from "@/lib/supabase/server-admin";
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
  const { name, email, password, revenue_share_pct, status, phone } = body as {
    name?: string;
    email?: string;
    password?: string;
    revenue_share_pct?: number;
    status?: string;
    phone?: string | null;
  };
  if (!name || !email)
    return NextResponse.json(
      { error: "Name and email required" },
      { status: 400 }
    );
  if (!password || typeof password !== "string" || password.length < 8)
    return NextResponse.json(
      { error: "Password is required and must be at least 8 characters" },
      { status: 400 }
    );

  const share = Number(revenue_share_pct);
  if (Number.isNaN(share) || share < 0 || share > 100)
    return NextResponse.json(
      { error: "Revenue share must be 0–100" },
      { status: 400 }
    );

  const admin = createServerAdminClient();

  const { data: authUser, error: authError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: name },
  });

  if (authError) {
    if (authError.message?.includes("already been registered"))
      return NextResponse.json({ error: "A user with this email already exists" }, { status: 400 });
    return NextResponse.json({ error: authError.message }, { status: 500 });
  }

  const authUserId = authUser.user.id;

  const { data: publisherRow, error: insertError } = await admin
    .from("publishers")
    .insert({
      name,
      email,
      revenue_share_pct: share,
      status: status === "suspended" ? "suspended" : "active",
      phone: phone || null,
    })
    .select("id")
    .single();

  if (insertError) {
    await admin.auth.admin.deleteUser(authUserId);
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  const { error: profileError } = await admin
    .from("profiles")
    .update({ publisher_id: publisherRow.id })
    .eq("id", authUserId);

  if (profileError) {
    await admin.from("publishers").delete().eq("id", publisherRow.id);
    await admin.auth.admin.deleteUser(authUserId);
    return NextResponse.json({ error: "Failed to link profile" }, { status: 500 });
  }

  return NextResponse.json({ id: publisherRow.id });
}
