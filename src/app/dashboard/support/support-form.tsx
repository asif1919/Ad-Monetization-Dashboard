"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/toast-provider";

export function SupportForm() {
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const { show } = useToast();
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!subject.trim() || !message.trim()) {
      show({
        type: "error",
        title: "Please fill in both fields",
      });
      return;
    }
    setLoading(true);
    const res = await fetch("/api/dashboard/support", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ subject: subject.trim(), message: message.trim() }),
    });
    const data = await res.json().catch(() => ({}));
    setLoading(false);
    if (!res.ok) {
      show({
        type: "error",
        title: "Could not send ticket",
        description: data.error ?? "Please try again.",
      });
      return;
    }
    show({
      type: "success",
      title: "Support ticket sent",
      description: "We’ll get back to you soon.",
    });
    setSubject("");
    setMessage("");
    router.refresh();
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-lg bg-white border border-gray-200 p-4 space-y-3"
    >
      <div>
        <label className="block text-sm font-medium text-gray-900 mb-1">
          Subject
        </label>
        <input
          type="text"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          maxLength={200}
          required
          className="w-full rounded border border-gray-300 px-3 py-2 text-sm bg-white text-gray-900 placeholder:text-gray-600"
          placeholder="Short summary of your issue"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-900 mb-1">
          Message
        </label>
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          rows={4}
          required
          className="w-full rounded border border-gray-300 px-3 py-2 text-sm bg-white text-gray-900 placeholder:text-gray-600"
          placeholder="Describe your question or problem"
        />
      </div>
      <button
        type="submit"
        disabled={loading}
        className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
      >
        {loading ? "Sending…" : "Send ticket"}
      </button>
    </form>
  );
}

