"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  parseExcelFile,
  getHeaders,
  applyMapping,
  type ColumnMapping,
  parseDate,
} from "@/lib/import-excel";

type Config = { month: number; year: number; real_data_imported_at: string | null };

export function ImportWizard({ configs }: { configs: Config[] }) {
  const router = useRouter();
  const [step, setStep] = useState<"upload" | "map" | "preview" | "done">("upload");
  const [file, setFile] = useState<File | null>(null);
  const [parsedData, setParsedData] = useState<unknown[][]>([]);
  const [mapping, setMapping] = useState<ColumnMapping>({});
  const [previewRows, setPreviewRows] = useState<ReturnType<typeof applyMapping>>([]);
  const [targetMonth, setTargetMonth] = useState("");
  const [targetYear, setTargetYear] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{
    total: number;
    imported: number;
    unmatched: string[];
    errors: string[];
  } | null>(null);

  const headers = parsedData.length > 0 ? getHeaders(parsedData) : [];

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setError(null);
    try {
      const buf = await f.arrayBuffer();
      const data = parseExcelFile(buf);
      setParsedData(data);
      setFile(f);
      setStep("map");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to parse file");
    }
  }

  function handleMap() {
    setPreviewRows(applyMapping(parsedData, mapping));
    setStep("preview");
  }

  async function handleImport() {
    if (!targetMonth || !targetYear) {
      setError("Select month and year");
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/admin/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          month: Number(targetMonth),
          year: Number(targetYear),
          mapping,
          rows: previewRows.map((r) => ({
            publisher_id: r.publisher_id,
            publisher_email: r.publisher_email,
            date: parseDate(r.date ?? ""),
            domain_site_id: r.domain_site_id,
            impressions: r.impressions ?? 0,
            clicks: r.clicks ?? 0,
            revenue: r.revenue ?? 0,
          })),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Import failed");
      setResult(data);
      setStep("done");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Import failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      {step === "upload" && (
        <div className="rounded-lg border border-gray-200 bg-white p-6">
          <label className="block text-sm font-medium text-gray-900 mb-2">
            Select Excel file (.xlsx)
          </label>
          <input
            type="file"
            accept=".xlsx,.xls"
            onChange={handleFile}
            className="block w-full text-sm text-gray-800 file:mr-4 file:rounded file:border-0 file:bg-blue-50 file:px-4 file:py-2 file:text-blue-700"
          />
          {error && (
            <p className="mt-2 text-sm text-red-600">{error}</p>
          )}
        </div>
      )}

      {step === "map" && (
        <div className="rounded-lg border border-gray-200 bg-white p-6 space-y-4">
          <h2 className="font-medium">Map columns</h2>
          <p className="text-sm text-gray-700">
            Choose which column index (0-based) maps to each field. At least one of Publisher ID or Publisher Email is required; Date and Revenue are required for import.
          </p>
          <div className="grid grid-cols-2 gap-4">
            {[
              ["publisher_id", "Publisher ID (optional)"],
              ["publisher_email", "Publisher email (optional)"],
              ["date", "Date"],
              ["domain_site_id", "Domain / Site ID (optional)"],
              ["impressions", "Impressions"],
              ["clicks", "Clicks"],
              ["revenue", "Revenue"],
            ].map(([key, label]) => (
              <div key={key}>
                <label className="block text-sm text-gray-900 mb-1">{label}</label>
                <select
                  value={mapping[key as keyof ColumnMapping] ?? ""}
                  onChange={(e) =>
                    setMapping((m) => ({
                      ...m,
                      [key]: e.target.value === "" ? undefined : Number(e.target.value),
                    }))
                  }
                  className="w-full rounded border border-gray-300 px-3 py-2 bg-white text-gray-900"
                >
                  <option value="">—</option>
                  {headers.map((h, i) => (
                    <option key={i} value={i}>
                      {i}: {h || "(empty)"}
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setStep("upload")}
              className="rounded border border-gray-300 px-4 py-2 text-gray-700 hover:bg-gray-50"
            >
              Back
            </button>
            <button
              type="button"
              onClick={handleMap}
              className="rounded bg-blue-600 px-4 py-2 text-white font-medium hover:bg-blue-700"
            >
              Preview
            </button>
          </div>
        </div>
      )}

      {step === "preview" && (
        <div className="rounded-lg border border-gray-200 bg-white p-6 space-y-4">
          <h2 className="font-medium">Preview & import</h2>
          <div className="flex gap-4 flex-wrap">
            <div>
              <label className="block text-sm text-gray-900 mb-1">Target month</label>
              <select
                value={targetMonth}
                onChange={(e) => setTargetMonth(e.target.value)}
                className="rounded border border-gray-300 px-3 py-2 bg-white text-gray-900"
              >
                <option value="">Select</option>
                {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm text-gray-900 mb-1">Target year</label>
              <input
                type="number"
                min={2020}
                max={2030}
                value={targetYear}
                onChange={(e) => setTargetYear(e.target.value)}
                className="w-24 rounded border border-gray-300 px-3 py-2 bg-white text-gray-900"
              />
            </div>
          </div>
          <div className="overflow-x-auto max-h-64 overflow-y-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50">
                  <th className="p-2 text-left">Date</th>
                  <th className="p-2 text-left">Publisher</th>
                  <th className="p-2 text-left">Impressions</th>
                  <th className="p-2 text-left">Clicks</th>
                  <th className="p-2 text-left">Revenue</th>
                </tr>
              </thead>
              <tbody>
                {previewRows.slice(0, 20).map((r, i) => (
                  <tr key={i} className="border-b border-gray-100">
                    <td className="p-2">{r.date ?? "—"}</td>
                    <td className="p-2">{r.publisher_id ?? r.publisher_email ?? "—"}</td>
                    <td className="p-2">{r.impressions ?? "—"}</td>
                    <td className="p-2">{r.clicks ?? "—"}</td>
                    <td className="p-2">{r.revenue ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-sm text-gray-700">
            Showing first 20 rows. Total: {previewRows.length}
          </p>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setStep("map")}
              className="rounded border border-gray-300 px-4 py-2 text-gray-700 hover:bg-gray-50"
            >
              Back
            </button>
            <button
              type="button"
              onClick={handleImport}
              disabled={loading}
              className="rounded bg-green-600 px-4 py-2 text-white font-medium hover:bg-green-700 disabled:opacity-50"
            >
              {loading ? "Importing…" : "Import"}
            </button>
          </div>
        </div>
      )}

      {step === "done" && result && (
        <div className="rounded-lg border border-green-200 bg-green-50 p-6">
          <h2 className="font-medium text-green-800">Import complete</h2>
          <ul className="mt-2 text-sm text-green-700 space-y-1">
            <li>Total rows: {result.total}</li>
            <li>Imported: {result.imported}</li>
            {result.unmatched.length > 0 && (
              <li>Unmatched: {result.unmatched.join(", ")}</li>
            )}
            {result.errors.length > 0 && (
              <li>Errors: {result.errors.slice(0, 5).join("; ")}</li>
            )}
          </ul>
          <button
            type="button"
            onClick={() => {
              setStep("upload");
              setFile(null);
              setParsedData([]);
              setResult(null);
              router.refresh();
            }}
            className="mt-4 rounded bg-green-600 px-4 py-2 text-white font-medium hover:bg-green-700"
          >
            Import another
          </button>
        </div>
      )}
    </div>
  );
}
