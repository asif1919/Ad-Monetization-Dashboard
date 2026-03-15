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
    </span>
  );
}
