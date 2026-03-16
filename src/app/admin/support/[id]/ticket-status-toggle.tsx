"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/toast-provider";

export function TicketStatusToggle({ id, status }: { id: string; status: string }) {
  const router = useRouter();
  const { show } = useToast();
  const [current, setCurrent] = useState(status);
  const [loading, setLoading] = useState(false);

  async function toggle() {
    const next = current === "open" ? "closed" : "open";
    setLoading(true);
    const res = await fetch(`/api/admin/support/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: next }),
    });
    const data = await res.json().catch(() => ({}));
    setLoading(false);
    if (!res.ok) {
      show({
        type: "error",
        title: "Could not update ticket",
        description: data.error ?? "Please try again.",
      });
      return;
    }
    setCurrent(next);
    show({
      type: "success",
      title: `Ticket ${next === "open" ? "reopened" : "closed"}`,
    });
    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={loading}
      className="rounded border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
    >
      {loading ? "Updating…" : current === "open" ? "Mark as closed" : "Reopen"}
    </button>
  );
}

