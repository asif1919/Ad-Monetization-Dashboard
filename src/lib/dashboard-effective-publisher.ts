import { cookies } from "next/headers";
import { createHmac, timingSafeEqual } from "crypto";
import { NextResponse } from "next/server";
import type { SupabaseClient, User } from "@supabase/supabase-js";

export const DASHBOARD_VIEW_AS_COOKIE = "dashboard_view_as";

/** Default view-as session length (8 hours). */
const VIEW_AS_MAX_AGE_SEC = 8 * 60 * 60;

type ViewAsPayload = {
  publisherId: string;
  adminUserId: string;
  exp: number;
};

/**
 * Signing secret for the view-as cookie. In production, set VIEW_AS_COOKIE_SECRET (min 16 chars).
 * In development, a fixed fallback is used so "View as publisher" works without extra env setup.
 */
function getViewAsSecret(): string {
  const s = process.env.VIEW_AS_COOKIE_SECRET?.trim();
  if (s && s.length >= 16) return s;
  if (process.env.NODE_ENV === "development") {
    return "__dev_only_view_as_secret_min32chars_do_not_use_in_prod__";
  }
  throw new Error(
    "VIEW_AS_COOKIE_SECRET must be set (min 16 characters) for view-as publisher"
  );
}

function b64url(buf: Buffer): string {
  return buf
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function b64urlDecode(s: string): Buffer {
  const pad = 4 - (s.length % 4);
  const b64 = s.replace(/-/g, "+").replace(/_/g, "/") + (pad < 4 ? "=".repeat(pad) : "");
  return Buffer.from(b64, "base64");
}

export function signViewAsCookieValue(
  publisherId: string,
  adminUserId: string,
  maxAgeMs: number = VIEW_AS_MAX_AGE_SEC * 1000
): string {
  const secret = getViewAsSecret();
  const payload: ViewAsPayload = {
    publisherId,
    adminUserId,
    exp: Date.now() + maxAgeMs,
  };
  const data = b64url(Buffer.from(JSON.stringify(payload), "utf8"));
  const sig = createHmac("sha256", secret).update(data).digest();
  const sigStr = b64url(sig);
  return `${data}.${sigStr}`;
}

export function verifyViewAsCookieValue(
  value: string | undefined,
  currentAdminUserId: string
): { publisherId: string } | null {
  if (!value || !value.includes(".")) return null;
  let secret: string;
  try {
    secret = getViewAsSecret();
  } catch {
    return null;
  }
  const [data, sigStr] = value.split(".");
  if (!data || !sigStr) return null;
  const expectedSig = createHmac("sha256", secret).update(data).digest();
  let sigBuf: Buffer;
  try {
    sigBuf = b64urlDecode(sigStr);
  } catch {
    return null;
  }
  if (sigBuf.length !== expectedSig.length) return null;
  try {
    if (!timingSafeEqual(sigBuf, expectedSig)) return null;
  } catch {
    return null;
  }
  let payload: ViewAsPayload;
  try {
    payload = JSON.parse(b64urlDecode(data).toString("utf8")) as ViewAsPayload;
  } catch {
    return null;
  }
  if (
    typeof payload.publisherId !== "string" ||
    typeof payload.adminUserId !== "string" ||
    typeof payload.exp !== "number"
  ) {
    return null;
  }
  if (payload.adminUserId !== currentAdminUserId) return null;
  if (payload.exp < Date.now()) return null;
  return { publisherId: payload.publisherId };
}

export type DashboardPublisherResolution =
  | {
      ok: true;
      user: User;
      publisherId: string;
      viewAs: boolean;
    }
  | {
      ok: false;
      redirectTo: "/login" | "/admin";
    };

/**
 * Resolves which publisher tenant the current dashboard request applies to.
 * Super admins need a valid view-as cookie; publishers use profile.publisher_id.
 */
export async function resolveDashboardPublisher(
  supabase: SupabaseClient
): Promise<DashboardPublisherResolution> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, redirectTo: "/login" };

  // View-as must be resolved BEFORE reading profiles. The cookie is signed for this user id; if it
  // verifies, we trust it without needing profile.role (avoids redirect to /login when the profile
  // row is missing or RLS returns no row even though auth.getUser() succeeded).
  const store = await cookies();
  const viewAsRaw = store.get(DASHBOARD_VIEW_AS_COOKIE)?.value;
  const viewAsVerified = verifyViewAsCookieValue(viewAsRaw, user.id);
  if (viewAsVerified) {
    return {
      ok: true,
      user,
      publisherId: viewAsVerified.publisherId,
      viewAs: true,
    };
  }

  let { data: profile } = await supabase
    .from("profiles")
    .select("role, publisher_id, preferred_currency")
    .eq("id", user.id)
    .single();

  if (!profile) {
    const { data: fallback } = await supabase
      .from("profiles")
      .select("role, publisher_id, preferred_currency")
      .eq("id", user.id)
      .single();
    profile = fallback ?? null;
  }

  if (profile?.role === "super_admin") {
    return { ok: false, redirectTo: "/admin" };
  }

  let publisherId = profile?.publisher_id as string | null | undefined;
  if (!publisherId && user.email) {
    const { data: pub } = await supabase
      .from("publishers")
      .select("id")
      .eq("email", user.email)
      .maybeSingle();
    if (pub?.id) {
      await supabase.from("profiles").update({ publisher_id: pub.id }).eq("id", user.id);
      publisherId = pub.id;
    }
  }

  if (!publisherId) return { ok: false, redirectTo: "/login" };

  return { ok: true, user, publisherId, viewAs: false };
}

export function viewAsCookieOptions(): {
  httpOnly: boolean;
  secure: boolean;
  sameSite: "lax";
  path: string;
  maxAge: number;
} {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: VIEW_AS_MAX_AGE_SEC,
  };
}

/** For Route Handlers under /api/dashboard: returns publisher scope or a ready JSON Response. */
export async function requireDashboardPublisherForApi(
  supabase: SupabaseClient
): Promise<
  | { publisherId: string; userId: string; viewAs: boolean }
  | { response: NextResponse }
> {
  const r = await resolveDashboardPublisher(supabase);
  if (!r.ok) {
    const status = r.redirectTo === "/login" ? 401 : 403;
    const msg = r.redirectTo === "/login" ? "Unauthorized" : "Forbidden";
    return { response: NextResponse.json({ error: msg }, { status }) };
  }
  return {
    publisherId: r.publisherId,
    userId: r.user.id,
    viewAs: r.viewAs,
  };
}
