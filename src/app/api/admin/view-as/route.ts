import { createClient } from "@/lib/supabase/server";
import {
  DASHBOARD_VIEW_AS_COOKIE,
  signViewAsCookieValue,
  verifyViewAsCookieValue,
  viewAsCookieOptions,
} from "@/lib/dashboard-effective-publisher";
import { NextResponse } from "next/server";

async function requireSuperAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (profile?.role !== "super_admin") {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  return { supabase, user };
}

/** Start view-as: set cookie and redirect to publisher dashboard. */
export async function POST(request: Request) {
  const auth = await requireSuperAdmin();
  if ("error" in auth) return auth.error;

  let body: { publisherId?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const publisherId = body?.publisherId?.trim();
  if (!publisherId) {
    return NextResponse.json({ error: "publisherId is required" }, { status: 400 });
  }

  const { data: pub } = await auth.supabase
    .from("publishers")
    .select("id")
    .eq("id", publisherId)
    .maybeSingle();
  if (!pub?.id) {
    return NextResponse.json({ error: "Publisher not found" }, { status: 404 });
  }

  let cookieValue: string;
  try {
    cookieValue = signViewAsCookieValue(pub.id, auth.user.id);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "View-as is not configured";
    return NextResponse.json({ error: msg }, { status: 500 });
  }

  const res = NextResponse.json({ ok: true, redirect: "/dashboard" });
  res.cookies.set(DASHBOARD_VIEW_AS_COOKIE, cookieValue, viewAsCookieOptions());
  return res;
}

/** Clear view-as cookie. */
export async function DELETE() {
  const auth = await requireSuperAdmin();
  if ("error" in auth) return auth.error;

  const res = NextResponse.json({ ok: true });
  res.cookies.set(DASHBOARD_VIEW_AS_COOKIE, "", {
    ...viewAsCookieOptions(),
    maxAge: 0,
  });
  return res;
}

/** Optional: verify cookie still valid (e.g. health check). */
export async function GET() {
  const auth = await requireSuperAdmin();
  if ("error" in auth) return auth.error;

  const { cookies: cookieStore } = await import("next/headers");
  const store = await cookieStore();
  const raw = store.get(DASHBOARD_VIEW_AS_COOKIE)?.value;
  const v = verifyViewAsCookieValue(raw, auth.user.id);
  return NextResponse.json({ active: !!v, publisherId: v?.publisherId ?? null });
}
