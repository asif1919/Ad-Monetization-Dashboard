"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/toast-provider";

export function MarkPaidButton({
  publisherId,
  month,
  year,
  disabled,
}: {
  publisherId: string;
  month: number;
  year: number;
  disabled: boolean;
}) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const { show } = useToast();

  async function markPaid() {
    setLoading(true);
    const res = await fetch("/api/admin/invoices/mark-paid", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ publisher_id: publisherId, month, year }),
    });
    const data = await res.json().catch(() => ({}));
    setLoading(false);
    if (!res.ok) {
      show({
        type: "error",
        title: "Could not update",
        description: typeof data.error === "string" ? data.error : "Try again.",
      });
      return;
    }
    show({ type: "success", title: "Marked as paid" });
    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={() => void markPaid()}
      disabled={disabled || loading}
      className="rounded bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-700 disabled:opacity-40 disabled:pointer-events-none"
    >
      {loading ? "Saving…" : "Mark paid"}
    </button>
  );
}
