"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function ViewAsPublisherBanner({ publisherName }: { publisherName: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function exit() {
    setLoading(true);
    try {
      await fetch("/api/admin/view-as", { method: "DELETE" });
      router.push("/admin/publishers");
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="mb-4 rounded-lg border border-amber-300/80 bg-amber-50 px-4 py-3 text-sm text-amber-950 flex flex-wrap items-center justify-between gap-3"
      role="status"
    >
      <p>
        <span className="font-semibold">Viewing as publisher:</span> {publisherName}. You are
        still signed in as admin; this session does not change the publisher&apos;s password.
      </p>
      <button
        type="button"
        onClick={exit}
        disabled={loading}
        className="shrink-0 rounded-md bg-amber-900 px-3 py-1.5 text-white text-sm font-medium hover:bg-amber-950 disabled:opacity-60"
      >
        {loading ? "Exiting…" : "Exit view as"}
      </button>
    </div>
  );
}
