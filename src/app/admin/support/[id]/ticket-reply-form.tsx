"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/toast-provider";

export function TicketReplyForm({
  id,
  initialReply,
}: {
  id: string;
  initialReply: string;
}) {
  const [reply, setReply] = useState(initialReply);
  const [loading, setLoading] = useState(false);
  const { show } = useToast();
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const res = await fetch(`/api/admin/support/${id}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: reply }),
    });
    const data = await res.json().catch(() => ({}));
    setLoading(false);
    if (!res.ok) {
      show({
        type: "error",
        title: "Could not save reply",
        description: data.error ?? "Please try again.",
      });
      return;
    }
    show({
      type: "success",
      title: "Reply sent",
    });
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-2">
      <label className="block text-sm font-medium text-gray-900">
        Admin reply
      </label>
      <textarea
        value={reply}
        onChange={(e) => setReply(e.target.value)}
        rows={3}
        className="w-full rounded border border-gray-300 px-3 py-2 text-sm bg-white text-gray-900 placeholder:text-gray-600"
        placeholder="Write a reply that the publisher will see in their dashboard"
      />
      <button
        type="submit"
        disabled={loading}
        className="rounded bg-blue-600 px-4 py-2 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50"
      >
        {loading ? "Saving…" : "Save reply"}
      </button>
    </form>
  );
}

