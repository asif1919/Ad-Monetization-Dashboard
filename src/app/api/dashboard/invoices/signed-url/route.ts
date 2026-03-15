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
    .select("publisher_id")
    .eq("id", user.id)
    .single();
  const publisherId = profile?.publisher_id;
  if (!publisherId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { searchParams } = new URL(request.url);
  const path = searchParams.get("path");
  if (!path || !path.startsWith(publisherId + "/")) {
    return NextResponse.json({ error: "Invalid path" }, { status: 400 });
  }

  const { data: signed } = await supabase.storage
    .from("invoices")
    .createSignedUrl(path, 60);

  if (signed?.signedUrl) return NextResponse.json({ url: signed.signedUrl });
  return NextResponse.json({ error: "Failed to create URL" }, { status: 500 });
}
