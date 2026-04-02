"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Props = {
  /** Same period as the page filter — no separate date pickers. */
  month: number;
  year: number;
};

type SkippedRow = {
  publisher_id: string;
  name: string | null;
  reason: string;
};

/** Batch-creates invoice PDFs + invoice/payout rows for publishers with daily stats and no invoice yet this month. */
export function GenerateInvoicesButton({ month, year }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<{
    generated: number;
    skipped: SkippedRow[];
  } | null>(null);

  async function generate() {
    setError(null);
    setLastResult(null);
    setLoading(true);
    const res = await fetch("/api/admin/invoices/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ month, year }),
    });
    const data = (await res.json().catch(() => ({}))) as {
      error?: string;
      generated?: number;
      skipped?: SkippedRow[];
    };
    setLoading(false);
    if (!res.ok) {
      setError(data.error ?? "Failed to generate");
      return;
    }
    setLastResult({
      generated: typeof data.generated === "number" ? data.generated : 0,
      skipped: Array.isArray(data.skipped) ? data.skipped : [],
    });
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-2 w-full max-w-md">
      <button
        type="button"
        onClick={generate}
        disabled={loading}
        className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-2.5 text-sm font-medium text-blue-900 hover:bg-blue-100 disabled:opacity-50 whitespace-normal text-left"
        title="Creates missing invoice PDFs and payout lines from imported traffic data for publishers who have not generated one yet this month."
      >
        {loading ? "Generating…" : `Create missing invoices for ${month}/${year}`}
      </button>
      <p className="text-xs text-gray-500 leading-snug">
        Optional: use after daily stats exist for this month (including estimates). Batch-creates PDFs for publishers
        who did not create their own. Existing invoices for this month are left as-is.
      </p>
      {error && <p className="text-sm text-red-600">{error}</p>}
      {lastResult && !error && (
        <div className="rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-800">
          <p className="font-medium text-gray-900">
            Created {lastResult.generated} new invoice{lastResult.generated === 1 ? "" : "s"} for {month}/{year}.
          </p>
          {lastResult.skipped.length > 0 && (
            <div className="mt-2">
              <p className="text-amber-900 font-medium text-xs">
                Skipped {lastResult.skipped.length} publisher
                {lastResult.skipped.length === 1 ? "" : "s"} (no daily stats with revenue for this month):
              </p>
              <ul className="mt-1 list-disc list-inside text-xs text-gray-700 max-h-40 overflow-y-auto space-y-0.5">
                {lastResult.skipped.map((s) => (
                  <li key={s.publisher_id}>
                    <span className="font-medium">{s.name ?? s.publisher_id}</span>
                    {" — "}
                    {s.reason}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
