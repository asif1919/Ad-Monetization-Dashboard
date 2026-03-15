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

  // getClaims() validates JWT locally when using asymmetric signing keys (no Auth server call)
  const { data: claims, error: claimsError } = await supabase.auth.getClaims();

  const hasValidSession = !claimsError && claims?.claims?.sub;

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
