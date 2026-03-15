import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

async function requireAdmin(supabase: Awaited<ReturnType<typeof createClient>>): Promise<NextResponse | null> {
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
  return null;
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const authError = await requireAdmin(supabase);
  if (authError) return authError;

  const body = await request.json();
  const { publisher_id, domain_site_id, display_name } = body as {
    publisher_id?: string;
    domain_site_id?: string;
    display_name?: string | null;
  };
  if (!publisher_id || !domain_site_id)
    return NextResponse.json(
      { error: "publisher_id and domain_site_id required" },
      { status: 400 }
    );

  const { error } = await supabase
    .from("domains")
    .update({
      publisher_id,
      domain_site_id,
      display_name: display_name ?? null,
    })
    .eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
