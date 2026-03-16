"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function PublisherSupportIndicator({ initialHasNew }: { initialHasNew: boolean }) {
  const pathname = usePathname();
  const [hasNew, setHasNew] = useState(initialHasNew);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel("support-messages-realtime-publisher")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "support_messages" },
        (payload) => {
          // Only care about admin messages, and only when not already on support page
          const row = payload.new as { sender_type?: string };
          if (row.sender_type === "admin" && !pathname?.startsWith("/dashboard/support")) {
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
    if (pathname?.startsWith("/dashboard/support")) {
      setHasNew(false);
    }
  }, [pathname]);

  if (!hasNew) return null;

  return (
    <span className="ml-1 inline-flex h-2 w-2 rounded-full bg-blue-500" aria-hidden="true" />
  );
}

