"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function AdminSupportIndicator({ initialHasNew }: { initialHasNew: boolean }) {
  const pathname = usePathname();
  const [hasNew, setHasNew] = useState(initialHasNew);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel("support-messages-realtime")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "support_messages" },
        () => {
          // Only show the indicator when not already on a support page
          if (!pathname?.startsWith("/admin/support")) {
            setHasNew(true);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [pathname]);

  useEffect(() => {
    if (pathname?.startsWith("/admin/support")) {
      // Visiting support clears the "new" state
      setHasNew(false);
    }
  }, [pathname]);

  if (!hasNew) return null;

  return (
    <span className="ml-1 inline-flex h-2 w-2 rounded-full bg-red-500" aria-hidden="true" />
  );
}

