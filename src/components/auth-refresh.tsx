"use client";

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

function refreshSession() {
  fetch("/api/auth/refresh", { method: "POST" }).catch(() => {});
}

export function AuthRefresh() {
  const pathname = usePathname();
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!pathname || !isProtectedPath(pathname)) return;

    refreshSession();

    intervalRef.current = setInterval(refreshSession, REFRESH_INTERVAL_MS);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [pathname]);

  return null;
}
