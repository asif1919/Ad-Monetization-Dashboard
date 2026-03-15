"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

type Publisher = {
  id: string;
  name: string;
  email: string;
  revenue_share_pct: number;
  status: "active" | "suspended";
};

export function PublisherForm({ publisher }: { publisher?: Publisher }) {
  const router = useRouter();
  const [name, setName] = useState(publisher?.name ?? "");
  const [email, setEmail] = useState(publisher?.email ?? "");
  const [revenueShare, setRevenueShare] = useState(
    String(publisher?.revenue_share_pct ?? 70)
  );
  const [status, setStatus] = useState<"active" | "suspended">(
    publisher?.status ?? "active"
  );
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const url = publisher
      ? `/api/admin/publishers/${publisher.id}`
      : "/api/admin/publishers";
    const res = await fetch(url, {
      method: publisher ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        email,
        revenue_share_pct: Number(revenueShare),
        status,
      }),
    });
    const data = await res.json().catch(() => ({}));
    setLoading(false);
    if (!res.ok) {
      setError(data.error ?? "Failed to save");
      return;
    }
    router.push("/admin/publishers");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-md space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-900 mb-1">
          Name
        </label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          className="w-full rounded border border-gray-300 px-3 py-2 bg-white text-gray-900 placeholder:text-gray-600"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-900 mb-1">
          Email
        </label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          disabled={!!publisher}
          className="w-full rounded border border-gray-300 px-3 py-2 disabled:bg-gray-100 disabled:text-gray-700"
        />
        {publisher && (
          <p className="text-xs text-gray-700 mt-1">Email cannot be changed.</p>
        )}
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-900 mb-1">
          Revenue share %
        </label>
        <input
          type="number"
          min={0}
          max={100}
          step={0.01}
          value={revenueShare}
          onChange={(e) => setRevenueShare(e.target.value)}
          required
          className="w-full rounded border border-gray-300 px-3 py-2 bg-white text-gray-900 placeholder:text-gray-600"
        />
      </div>
      {publisher && (
        <div>
          <label className="block text-sm font-medium text-gray-900 mb-1">
            Status
          </label>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as "active" | "suspended")}
            className="w-full rounded border border-gray-300 px-3 py-2 bg-white text-gray-900 placeholder:text-gray-600"
          >
            <option value="active">Active</option>
            <option value="suspended">Suspended</option>
          </select>
        </div>
      )}
      {error && (
        <p className="text-sm text-red-600 bg-red-50 p-2 rounded">{error}</p>
      )}
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={loading}
          className="rounded bg-blue-600 px-4 py-2 text-white font-medium hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? "Saving…" : publisher ? "Update" : "Create"}
        </button>
        <Link
          href="/admin/publishers"
          className="rounded border border-gray-300 px-4 py-2 text-gray-700 hover:bg-gray-50"
        >
          Cancel
        </Link>
      </div>
    </form>
  );
}
