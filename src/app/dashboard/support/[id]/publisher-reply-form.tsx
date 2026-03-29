"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/toast-provider";

export function PublisherReplyForm({ ticketId }: { ticketId: string }) {
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const { show } = useToast();
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = message.trim();
    if (!trimmed) return;
    setLoading(true);
    const res = await fetch(`/api/dashboard/support/${ticketId}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: trimmed }),
    });
    const data = await res.json().catch(() => ({}));
    setLoading(false);
    if (!res.ok) {
      show({
        type: "error",
        title: "Could not send reply",
        description: typeof data.error === "string" ? data.error : "Please try again.",
      });
      return;
    }
    setMessage("");
    show({ type: "success", title: "Reply sent" });
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="mt-10 space-y-3">
      <label htmlFor="publisher-reply" className="block text-sm font-semibold text-slate-800">
        Your reply
      </label>
      <textarea
        id="publisher-reply"
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        rows={4}
        className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-900 shadow-sm placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
        placeholder="Add a message to this thread…"
      />
      <button
        type="submit"
        disabled={loading || !message.trim()}
        className="rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 disabled:opacity-50"
      >
        {loading ? "Sending…" : "Send reply"}
      </button>
    </form>
  );
}
