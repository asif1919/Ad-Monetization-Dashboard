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

  const pathname = request.nextUrl.pathname;

  if (!hasValidSession) {
    if (
      pathname === "/" ||
      pathname.startsWith("/admin") ||
      pathname.startsWith("/dashboard")
    ) {
      return NextResponse.redirect(new URL("/login", request.url));
    }
  }

  return response;
}
