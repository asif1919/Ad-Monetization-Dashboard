import { createClient } from "@/lib/supabase/server";
import { createServerAdminClient } from "@/lib/supabase/server-admin";
import { NextResponse } from "next/server";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
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
  const { status } = body as { status?: string };
  if (!status || !["active", "suspended"].includes(status))
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });

  const { error } = await supabase
    .from("publishers")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
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
  const { name, revenue_share_pct, status, phone, website_url, allow_adult, allow_gambling } =
    body as {
    name?: string;
    revenue_share_pct?: number;
    status?: string;
    phone?: string | null;
    website_url?: string | null;
    allow_adult?: boolean;
    allow_gambling?: boolean;
  };
  if (!name) return NextResponse.json({ error: "Name required" }, { status: 400 });

  const share = revenue_share_pct != null ? Number(revenue_share_pct) : undefined;
  if (share != null && (Number.isNaN(share) || share < 0 || share > 100))
    return NextResponse.json(
      { error: "Revenue share must be 0–100" },
      { status: 400 }
    );

  const updates: Record<string, unknown> = {
    name,
    updated_at: new Date().toISOString(),
  };
  if (share != null) updates.revenue_share_pct = share;
  if (status === "active" || status === "suspended") updates.status = status;
  if (phone !== undefined) updates.phone = phone || null;
  if (website_url !== undefined) updates.website_url = website_url || null;
  if (allow_adult !== undefined) updates.allow_adult = !!allow_adult;
  if (allow_gambling !== undefined) updates.allow_gambling = !!allow_gambling;

  const { error } = await supabase
    .from("publishers")
    .update(updates)
    .eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: publisherId } = await params;
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

  const admin = createServerAdminClient();

  const { data: linkedProfile } = await admin
    .from("profiles")
    .select("id")
    .eq("publisher_id", publisherId)
    .maybeSingle();

  if (linkedProfile?.id) {
    const { error: deleteUserError } = await admin.auth.admin.deleteUser(linkedProfile.id);
    if (deleteUserError) {
      return NextResponse.json({ error: deleteUserError.message }, { status: 500 });
    }
  }

  const { error: deleteError } = await admin
    .from("publishers")
    .delete()
    .eq("id", publisherId);

  if (deleteError) return NextResponse.json({ error: deleteError.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
