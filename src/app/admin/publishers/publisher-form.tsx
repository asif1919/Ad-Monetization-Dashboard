"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useToast } from "@/components/ui/toast-provider";

type Publisher = {
  id: string;
  name: string;
  email: string;
  revenue_share_pct: number;
  status: "active" | "suspended";
  phone?: string | null;
  website_url?: string | null;
  allow_adult?: boolean;
  allow_gambling?: boolean;
  public_id?: string | null;
};

export function PublisherForm({ publisher }: { publisher?: Publisher }) {
  const router = useRouter();
  const [name, setName] = useState(publisher?.name ?? "");
  const [email, setEmail] = useState(publisher?.email ?? "");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState(publisher?.phone ?? "");
  const [websiteUrl, setWebsiteUrl] = useState(publisher?.website_url ?? "");
  const [revenueShare, setRevenueShare] = useState(
    String(publisher?.revenue_share_pct ?? 70)
  );
  const [status, setStatus] = useState<"active" | "suspended">(
    publisher?.status ?? "active"
  );
  const [allowAdult, setAllowAdult] = useState<boolean>(publisher?.allow_adult ?? false);
  const [allowGambling, setAllowGambling] = useState<boolean>(
    publisher?.allow_gambling ?? false
  );
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const { show } = useToast();
  const publicId = publisher?.public_id ?? null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!publisher && (!password || password.length < 8)) {
      setError("Password is required and must be at least 8 characters");
      return;
    }
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
        password: !publisher ? password : undefined,
        phone: phone.trim() || null,
        website_url: websiteUrl.trim() || null,
        revenue_share_pct: Number(revenueShare),
        status,
        allow_adult: allowAdult,
        allow_gambling: allowGambling,
      }),
    });
    const data = await res.json().catch(() => ({}));
    setLoading(false);
    if (!res.ok) {
      setError(data.error ?? "Failed to save");
      show({
        type: "error",
        title: "Could not save publisher",
        description: data.error ?? "Please check the form and try again.",
      });
      return;
    }
    show({
      type: "success",
      title: publisher ? "Publisher updated" : "Publisher created",
      description: "Your changes have been applied.",
    });
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
      {publicId && (
        <div>
          <label className="block text-sm font-medium text-gray-900 mb-1">
            Publisher report ID
          </label>
          <div className="flex items-center gap-2">
            <code className="px-2 py-1 rounded bg-gray-100 text-xs text-gray-900">
              {publicId}
            </code>
          </div>
          <p className="text-xs text-gray-600 mt-1">
            Public identifier for this publisher (e.g. integrations or reporting references).
          </p>
        </div>
      )}
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
      {!publisher && (
        <div>
          <label className="block text-sm font-medium text-gray-900 mb-1">
            Password
          </label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={8}
            placeholder="Min 8 characters (publisher will use this to log in)"
            className="w-full rounded border border-gray-300 px-3 py-2 bg-white text-gray-900 placeholder:text-gray-600"
          />
        </div>
      )}
      <div>
        <label className="block text-sm font-medium text-gray-900 mb-1">
          Phone (optional)
        </label>
        <input
          type="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="e.g. +1234567890"
          className="w-full rounded border border-gray-300 px-3 py-2 bg-white text-gray-900 placeholder:text-gray-600"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-900 mb-1">
          Website URL (optional)
        </label>
        <input
          type="url"
          value={websiteUrl}
          onChange={(e) => setWebsiteUrl(e.target.value)}
          placeholder="https://publisher-site.com"
          className="w-full rounded border border-gray-300 px-3 py-2 bg-white text-gray-900 placeholder:text-gray-600"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-900 mb-1">
          Revenue share %
        </label>
        <input
          type="number"
          min={0}
          max={100}
          step={1}
          value={revenueShare}
          onChange={(e) => {
            const v = e.target.value;
            if (v === "") setRevenueShare("");
            else {
              const n = Number(v);
              if (!Number.isNaN(n)) setRevenueShare(String(Math.min(100, Math.max(0, Math.round(n)))));
            }
          }}
          required
          className="w-full rounded border border-gray-300 px-3 py-2 bg-white text-gray-900 placeholder:text-gray-600"
        />
      </div>
      <div className="flex gap-4">
        <label className="inline-flex items-center gap-2 text-sm text-gray-900">
          <input
            type="checkbox"
            checked={allowAdult}
            onChange={(e) => setAllowAdult(e.target.checked)}
            className="rounded border-gray-300"
          />
          <span>Allow adult ads</span>
        </label>
        <label className="inline-flex items-center gap-2 text-sm text-gray-900">
          <input
            type="checkbox"
            checked={allowGambling}
            onChange={(e) => setAllowGambling(e.target.checked)}
            className="rounded border-gray-300"
          />
          <span>Allow gambling ads</span>
        </label>
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
