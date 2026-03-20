"use client";

import { createClient } from "@/lib/supabase/client";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

const REFRESH_INTERVAL_MS = 45 * 60 * 1000; // 45 minutes

function isProtectedPath(pathname: string) {
  return (
    pathname === "/" ||
    pathname.startsWith("/admin") ||
    pathname.startsWith("/dashboard")
  );
}

async function refreshSession() {
  const res = await fetch("/api/auth/refresh", { method: "POST" });
  if (res.status === 401) {
    const supabase = createClient();
    await supabase.auth.signOut();
    window.location.assign("/login?reason=session");
  }
}

export function AuthRefresh() {
  const pathname = usePathname();
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!pathname || !isProtectedPath(pathname)) return;

    void refreshSession();

    intervalRef.current = setInterval(() => void refreshSession(), REFRESH_INTERVAL_MS);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [pathname]);

  return null;
}
