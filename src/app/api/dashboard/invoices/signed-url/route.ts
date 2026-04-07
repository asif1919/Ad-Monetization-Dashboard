import { createClient } from "@/lib/supabase/server";
import { requireDashboardPublisherForApi } from "@/lib/dashboard-effective-publisher";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const supabase = await createClient();
  const scope = await requireDashboardPublisherForApi(supabase);
  if ("response" in scope) return scope.response;
  const { publisherId } = scope;

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
