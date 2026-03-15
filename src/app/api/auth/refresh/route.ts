import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

/**
 * Refreshes the auth session using the session in the request cookies.
 * Call from the client (e.g. on app load or on a timer) so the session
 * stays fresh without blocking middleware or page loads.
 */
export async function POST() {
  const supabase = await createClient();
  await supabase.auth.getUser();
  return NextResponse.json({ ok: true });
}
