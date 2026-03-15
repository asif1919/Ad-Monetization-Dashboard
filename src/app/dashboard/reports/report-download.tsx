"use client";

import { useState, useEffect } from "react";

export function ReportDownload({ publisherId }: { publisherId: string }) {
  const [months, setMonths] = useState<{ month: number; year: number }[]>([]);
  const [selected, setSelected] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/dashboard/reports/months")
      .then((r) => r.json())
      .then((data) => setMonths(data.months ?? []))
      .catch(() => setMonths([]));
  }, []);

  async function download() {
    if (!selected) return;
    setError(null);
    setLoading(true);
    try {
      const res = await fetch(
        `/api/dashboard/reports/download?month=${selected.split("-")[0]}&year=${selected.split("-")[1]}`
      );
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error ?? "Download not allowed");
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `report-${selected}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Download failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4">
      <h3 className="font-medium text-gray-900 mb-2">Download monthly report (CSV)</h3>
      <p className="text-sm text-gray-700 mb-3">
        Reports are available only for months where real data has been imported. No daily or weekly download.
      </p>
      <div className="flex gap-2 items-center">
        <select
          value={selected}
          onChange={(e) => setSelected(e.target.value)}
          className="rounded border border-gray-300 px-3 py-2 bg-white text-gray-900"
        >
          <option value="">Select month</option>
          {months.map((m) => {
            const v = `${m.year}-${String(m.month).padStart(2, "0")}`;
            return (
              <option key={v} value={v}>
                {m.month}/{m.year}
              </option>
            );
          })}
        </select>
        <button
          type="button"
          onClick={download}
          disabled={!selected || loading}
          className="rounded bg-blue-600 px-4 py-2 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? "Downloading…" : "Download CSV"}
        </button>
      </div>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </div>
  );
}
