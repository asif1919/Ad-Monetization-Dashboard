import { authDebug } from "@/lib/auth-debug";
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({
    request,
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options?: Record<string, unknown> }[]) {
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Refresh session from cookies; invalid/missing refresh token clears session on signOut elsewhere
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  const hasValidSession = !userError && !!user;

  const isStaleRefresh =
    !!userError &&
    ((userError as { code?: string }).code === "refresh_token_not_found" ||
      userError.message?.includes("Refresh Token Not Found"));

  const pathname = request.nextUrl.pathname;
  const cookieNames = request.cookies.getAll().map((c) => c.name);

  authDebug("middleware", {
    pathname,
    hasUser: !!user,
    userId: user?.id ?? null,
    getUserError: userError?.message ?? null,
    getUserCode: (userError as { code?: string } | null)?.code ?? null,
    cookieNames,
  });

  /** Clear broken Supabase session cookies so the client stops sending an invalid token on every request. */
  function clearStaleSupabaseCookies(res: NextResponse) {
    const secure = process.env.NODE_ENV === "production";
    for (const c of request.cookies.getAll()) {
      if (c.name.startsWith("sb-")) {
        res.cookies.set(c.name, "", {
          path: "/",
          maxAge: 0,
          sameSite: "lax",
          secure,
        });
      }
    }
  }

  if (!hasValidSession) {
    if (
      pathname === "/" ||
      pathname.startsWith("/admin") ||
      pathname.startsWith("/dashboard")
    ) {
      authDebug("middleware", {
        step: "redirectLogin",
        pathname,
        reason: userError?.message ?? "no_user",
        clearedStaleSession: isStaleRefresh,
      });
      const redirect = NextResponse.redirect(new URL("/login", request.url));
      if (isStaleRefresh) {
        clearStaleSupabaseCookies(redirect);
      }
      return redirect;
    }
  }

  if (isStaleRefresh) {
    clearStaleSupabaseCookies(response);
  }

  return response;
}
