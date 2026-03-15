"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

type Publisher = { id: string; name: string };
type Domain = {
  id: string;
  publisher_id: string;
  domain_site_id: string;
  display_name: string | null;
};

export function DomainForm({
  publishers,
  domain,
}: {
  publishers: Publisher[];
  domain?: Domain;
}) {
  const router = useRouter();
  const [publisherId, setPublisherId] = useState(domain?.publisher_id ?? "");
  const [domainSiteId, setDomainSiteId] = useState(
    domain?.domain_site_id ?? ""
  );
  const [displayName, setDisplayName] = useState(
    domain?.display_name ?? ""
  );
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const url = domain
      ? `/api/admin/domains/${domain.id}`
      : "/api/admin/domains";
    const res = await fetch(url, {
      method: domain ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        publisher_id: publisherId,
        domain_site_id: domainSiteId,
        display_name: displayName || null,
      }),
    });
    const data = await res.json().catch(() => ({}));
    setLoading(false);
    if (!res.ok) {
      setError(data.error ?? "Failed to save");
      return;
    }
    router.push("/admin/domains");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-md space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-900 mb-1">
          Publisher
        </label>
        <select
          value={publisherId}
          onChange={(e) => setPublisherId(e.target.value)}
          required
          className="w-full rounded border border-gray-300 px-3 py-2 bg-white text-gray-900 placeholder:text-gray-600"
        >
          <option value="">Select publisher</option>
          {publishers.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-900 mb-1">
          Domain / Site ID
        </label>
        <input
          type="text"
          value={domainSiteId}
          onChange={(e) => setDomainSiteId(e.target.value)}
          required
          placeholder="e.g. example.com or site_123"
          className="w-full rounded border border-gray-300 px-3 py-2 bg-white text-gray-900 placeholder:text-gray-600"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-900 mb-1">
          Display name (optional)
        </label>
        <input
          type="text"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          className="w-full rounded border border-gray-300 px-3 py-2 bg-white text-gray-900 placeholder:text-gray-600"
        />
      </div>
      {error && (
        <p className="text-sm text-red-600 bg-red-50 p-2 rounded">{error}</p>
      )}
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={loading}
          className="rounded bg-blue-600 px-4 py-2 text-white font-medium hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? "Saving…" : domain ? "Update" : "Create"}
        </button>
        <Link
          href="/admin/domains"
          className="rounded border border-gray-300 px-4 py-2 text-gray-700 hover:bg-gray-50"
        >
          Cancel
        </Link>
      </div>
    </form>
  );
}
