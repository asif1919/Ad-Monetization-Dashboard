"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function ConfigForm() {
  const router = useRouter();
  const current = new Date();
  const [month, setMonth] = useState(String(current.getMonth() + 1));
  const [year, setYear] = useState(String(current.getFullYear()));
  const [expectedRevenue, setExpectedRevenue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const res = await fetch("/api/admin/config", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        month: Number(month),
        year: Number(year),
        expected_revenue: Number(expectedRevenue),
      }),
    });
    const data = await res.json().catch(() => ({}));
    setLoading(false);
    if (!res.ok) {
      setError(data.error ?? "Failed to save");
      return;
    }
    router.refresh();
    setExpectedRevenue("");
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-wrap items-end gap-4 p-4 rounded-lg bg-white border border-gray-200"
    >
      <div>
        <label className="block text-sm font-medium text-gray-900 mb-1">
          Month
        </label>
        <select
          value={month}
          onChange={(e) => setMonth(e.target.value)}
          className="rounded border border-gray-300 px-3 py-2 bg-white text-gray-900 placeholder:text-gray-600"
        >
          {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-900 mb-1">
          Year
        </label>
        <input
          type="number"
          min={2020}
          max={2030}
          value={year}
          onChange={(e) => setYear(e.target.value)}
          className="w-24 rounded border border-gray-300 px-3 py-2 bg-white text-gray-900"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-900 mb-1">
          Expected monthly revenue (USD)
        </label>
        <input
          type="number"
          min={0}
          step={0.01}
          value={expectedRevenue}
          onChange={(e) => setExpectedRevenue(e.target.value)}
          required
          placeholder="1000"
          className="w-36 rounded border border-gray-300 px-3 py-2 bg-white text-gray-900 placeholder:text-gray-600"
        />
      </div>
      {error && (
        <p className="text-sm text-red-600">{error}</p>
      )}
      <button
        type="submit"
        disabled={loading}
        className="rounded bg-blue-600 px-4 py-2 text-white font-medium hover:bg-blue-700 disabled:opacity-50"
      >
        {loading ? "Saving…" : "Set & generate estimated data"}
      </button>
    </form>
  );
}
