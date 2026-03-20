import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

/**
 * Refreshes the auth session using the session in the request cookies.
 * Call from the client (e.g. on app load or on a timer) so the session
 * stays fresh without blocking middleware or page loads.
 */
export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    // Stale or missing refresh token — clear cookies so client stops retrying
    await supabase.auth.signOut();
    return NextResponse.json(
      { ok: false, error: error?.message ?? "no_session" },
      { status: 401 }
    );
  }

  return NextResponse.json({ ok: true });
}
