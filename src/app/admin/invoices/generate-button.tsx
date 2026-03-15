"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function GenerateButton() {
  const router = useRouter();
  const [month, setMonth] = useState(String(new Date().getMonth() || 12));
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function generate() {
    setError(null);
    setLoading(true);
    const res = await fetch("/api/admin/invoices/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ month: Number(month), year: Number(year) }),
    });
    const data = await res.json().catch(() => ({}));
    setLoading(false);
    if (!res.ok) {
      setError(data.error ?? "Failed to generate");
      return;
    }
    router.refresh();
  }

  return (
    <div className="flex items-center gap-2">
      <select
        value={month}
        onChange={(e) => setMonth(e.target.value)}
        className="rounded border border-gray-300 px-3 py-2 text-sm bg-white text-gray-900"
      >
        {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
          <option key={m} value={m}>{m}</option>
        ))}
      </select>
      <input
        type="number"
        min={2020}
        max={2030}
        value={year}
        onChange={(e) => setYear(e.target.value)}
        className="w-20 rounded border border-gray-300 px-3 py-2 text-sm bg-white text-gray-900"
      />
      <button
        type="button"
        onClick={generate}
        disabled={loading}
        className="rounded bg-blue-600 px-4 py-2 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
      >
        {loading ? "Generating…" : "Generate invoices"}
      </button>
      {error && <span className="text-sm text-red-600">{error}</span>}
    </div>
  );
}
