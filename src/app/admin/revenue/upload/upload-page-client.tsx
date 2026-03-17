"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { parseExcelFile, parseDate } from "@/lib/import-excel";

type Props = {
  publisherId: string;
  publisherName: string;
  publicId: string | null;
  month: number;
  year: number;
};

export function UploadPageClient({
  publisherId,
  publisherName,
  publicId,
  month,
  year,
}: Props) {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{
    status: "accepted" | "declined" | null;
    total: number;
    imported: number;
    errors: string[];
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) {
      setError("Please select a CSV or Excel file.");
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const buf = await file.arrayBuffer();
      const data = parseExcelFile(buf);
      if (!data || data.length < 2) {
        setError("File appears to be empty.");
        setLoading(false);
        return;
      }
      // Assume first row is header: Date, Impressions, Clicks, Revenue
      const rows = data.slice(1).map((row) => {
        const r = Array.isArray(row) ? row : [];
        const rawDate = (r[0] ?? "") as string;
        return {
          date: parseDate(String(rawDate)),
          impressions: Number(String(r[1] ?? "").replace(/[^0-9.-]/g, "")) || 0,
          clicks: Number(String(r[2] ?? "").replace(/[^0-9.-]/g, "")) || 0,
          revenue: Number(String(r[3] ?? "").replace(/[^0-9.-]/g, "")) || 0,
        };
      });

      const res = await fetch("/api/admin/revenue/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          month,
          year,
          publisher_id: publisherId,
          rows,
        }),
      });
      const dataJson = await res.json();
      setResult({
        status: dataJson.status ?? (res.ok ? "accepted" : "declined"),
        total: dataJson.total ?? rows.length,
        imported: dataJson.imported ?? 0,
        errors: dataJson.errors ?? [],
      });
      if (!res.ok && dataJson.error && !dataJson.errors) {
        setError(dataJson.error);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setLoading(false);
    }
  }

  const monthName = new Date(year, month - 1, 1).toLocaleString(undefined, {
    month: "long",
    year: "numeric",
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900 mb-2">
          Upload report
        </h1>
        <p className="text-sm text-gray-700">
          Publisher: <span className="font-medium">{publisherName}</span>{" "}
          {publicId && (
            <span className="ml-2 text-xs text-gray-600">
              (Report ID: <code>{publicId}</code>)
            </span>
          )}
          <br />
          Period: <span className="font-medium">{monthName}</span>
        </p>
        <p className="text-xs text-gray-600 mt-2">
          Expected columns in the first sheet:{" "}
          <code>Date, Impressions, Clicks, Revenue</code> in that order.
          Dates must be inside the selected month.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4 max-w-md">
        <div>
          <label className="block text-sm font-medium text-gray-900 mb-1">
            CSV or Excel file
          </label>
          <input
            type="file"
            accept=".csv,.xlsx,.xls"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="block w-full text-sm text-gray-800 file:mr-4 file:rounded file:border-0 file:bg-blue-50 file:px-4 file:py-2 file:text-blue-700"
          />
        </div>
        {error && (
          <p className="text-sm text-red-600 bg-red-50 p-2 rounded">{error}</p>
        )}
        <div className="flex gap-2">
          <button
            type="submit"
            disabled={loading}
            className="rounded bg-blue-600 px-4 py-2 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? "Uploading…" : "Upload & validate"}
          </button>
          <button
            type="button"
            className="rounded border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
            onClick={() => router.push(`/admin/revenue?month=${month}&year=${year}`)}
          >
            Back to Revenue & Payouts
          </button>
        </div>
      </form>

      {result && (
        <div
          className={`rounded-lg border p-4 text-sm ${
            result.status === "accepted"
              ? "border-green-200 bg-green-50 text-green-800"
              : "border-red-200 bg-red-50 text-red-800"
          }`}
        >
          <p className="font-medium mb-1">
            {result.status === "accepted" ? "Accepted" : "Declined"}
          </p>
          <ul className="space-y-1">
            <li>Total rows: {result.total}</li>
            <li>Imported: {result.imported}</li>
            {result.errors.length > 0 && (
              <li>
                Errors:
                <ul className="list-disc ml-5 mt-1 space-y-0.5">
                  {result.errors.map((e, i) => (
                    <li key={i}>{e}</li>
                  ))}
                </ul>
              </li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
}

