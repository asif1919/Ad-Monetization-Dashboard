import { createClient } from "@/lib/supabase/server";
import { createServerAdminClient } from "@/lib/supabase/server-admin";
import { NextResponse } from "next/server";

export async function POST(
  request: Request,
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

  let body: { password?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const password = body?.password;
  if (!password || typeof password !== "string" || password.length < 8) {
    return NextResponse.json(
      { error: "Password is required and must be at least 8 characters" },
      { status: 400 }
    );
  }

  const { data: publisherProfile, error: profErr } = await supabase
    .from("profiles")
    .select("id")
    .eq("publisher_id", publisherId)
    .eq("role", "publisher")
    .maybeSingle();

  if (profErr || !publisherProfile?.id) {
    return NextResponse.json(
      { error: "No login found for this publisher" },
      { status: 404 }
    );
  }

  const admin = createServerAdminClient();
  const { error: updateErr } = await admin.auth.admin.updateUserById(
    publisherProfile.id,
    { password }
  );

  if (updateErr) {
    return NextResponse.json(
      { error: updateErr.message ?? "Could not update password" },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true });
}
