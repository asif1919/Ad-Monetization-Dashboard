"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

type Props = { publisherId: string; status: string; name: string };

export function PublisherActions({ publisherId, status, name }: Props) {
  const router = useRouter();

  async function toggleSuspend() {
    const newStatus = status === "active" ? "suspended" : "active";
    const res = await fetch(`/api/admin/publishers/${publisherId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus }),
    });
    if (res.ok) router.refresh();
  }

  async function deletePublisher() {
    const ok = confirm(
      `Delete publisher "${name}"? Their login will be removed and all related data (domains, stats, payouts, invoices) will be deleted. This cannot be undone.`
    );
    if (!ok) return;
    const res = await fetch(`/api/admin/publishers/${publisherId}`, {
      method: "DELETE",
    });
    if (res.ok) {
      router.refresh();
    } else {
      const data = await res.json().catch(() => ({}));
      alert(data.error ?? "Failed to delete");
    }
  }

  return (
    <span className="flex items-center gap-2">
      <Link
        href={`/admin/publishers/${publisherId}/edit`}
        className="text-blue-600 hover:underline"
      >
        Edit
      </Link>
      <button
        type="button"
        onClick={toggleSuspend}
        className="text-amber-600 hover:underline"
      >
        {status === "active" ? "Suspend" : "Activate"}
      </button>
      <button
        type="button"
        onClick={deletePublisher}
        className="text-red-600 hover:underline"
      >
        Delete
      </button>
    </span>
  );
}
