"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  parseExcelFile,
  parsePublisherRevenueReportRows,
  PUBLISHER_REPORT_HEADER_NAMES,
} from "@/lib/import-excel";
import type { RevenueUploadInputRow } from "@/lib/revenue-upload";

const MAX_FILE_BYTES = 10 * 1024 * 1024;

type PreviewStats = {
  total_input_rows: number;
  valid_row_count_before_dedupe: number;
  unique_day_count: number;
  min_stat_date: string | null;
  max_stat_date: string | null;
};

type PreviewResponse = {
  ok: boolean;
  errors: string[];
  warnings: string[];
  stats: PreviewStats;
  cleanedRowsCount: number;
};

export type UploadReportModalProps = {
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  publisherId: string;
  publisherName: string;
  publicId: string | null;
  month: number;
  year: number;
};

function monthLabel(month: number, year: number) {
  return new Date(year, month - 1, 1).toLocaleString(undefined, {
    month: "long",
    year: "numeric",
  });
}

function formatDateRangeLabel(
  min: string | null,
  max: string | null,
  uniqueDays: number
): string {
  if (!min || !max) return "—";
  const d1 = new Date(`${min}T12:00:00`);
  const d2 = new Date(`${max}T12:00:00`);
  const opts: Intl.DateTimeFormatOptions = {
    day: "numeric",
    month: "short",
    year: "numeric",
  };
  const a = d1.toLocaleDateString(undefined, opts);
  const b = d2.toLocaleDateString(undefined, opts);
  return `${a} – ${b} (${uniqueDays} day${uniqueDays === 1 ? "" : "s"})`;
}

function parseFileToRows(buf: ArrayBuffer): {
  rows: RevenueUploadInputRow[];
  error: string | null;
} {
  const data = parseExcelFile(buf);
  return parsePublisherRevenueReportRows(data);
}

export function UploadReportModal({
  open,
  onClose,
  onSuccess,
  publisherId,
  publisherName,
  publicId,
  month,
  year,
}: UploadReportModalProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [phase, setPhase] = useState<
    | "idle"
    | "parsing"
    | "previewing"
    | "ready"
    | "committing"
    | "success"
    | "error"
  >("idle");
  const [dragActive, setDragActive] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [parsedRows, setParsedRows] = useState<RevenueUploadInputRow[] | null>(
    null
  );
  const [preview, setPreview] = useState<PreviewResponse | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const reset = useCallback(() => {
    setPhase("idle");
    setDragActive(false);
    setFileName(null);
    setParsedRows(null);
    setPreview(null);
    setMessage(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, []);

  useEffect(() => {
    if (!open) reset();
  }, [open, reset]);

  const runPreview = useCallback(
    async (rows: RevenueUploadInputRow[]) => {
      setPhase("previewing");
      setMessage(null);
      setPreview(null);
      try {
        const res = await fetch("/api/admin/revenue/upload", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            mode: "preview",
            month,
            year,
            publisher_id: publisherId,
            rows,
          }),
        });
        const data = (await res.json()) as PreviewResponse & { error?: string };
        if (!res.ok && data.error && !("ok" in data && data.ok !== undefined)) {
          setMessage(data.error ?? "Preview failed");
          setPhase("error");
          return;
        }
        setPreview({
          ok: Boolean(data.ok),
          errors: Array.isArray(data.errors) ? data.errors : [],
          warnings: Array.isArray(data.warnings) ? data.warnings : [],
          stats: data.stats ?? {
            total_input_rows: rows.length,
            valid_row_count_before_dedupe: 0,
            unique_day_count: 0,
            min_stat_date: null,
            max_stat_date: null,
          },
          cleanedRowsCount: typeof data.cleanedRowsCount === "number" ? data.cleanedRowsCount : 0,
        });
        setPhase(data.ok ? "ready" : "idle");
        if (!data.ok) {
          setMessage("Fix the file and try again, or choose another file.");
        }
      } catch (e) {
        setMessage(e instanceof Error ? e.message : "Preview failed");
        setPhase("error");
      }
    },
    [month, year, publisherId]
  );

  const processFile = useCallback(
    async (file: File) => {
      setMessage(null);
      if (file.size > MAX_FILE_BYTES) {
        setMessage(`File is too large (max ${MAX_FILE_BYTES / (1024 * 1024)} MB).`);
        setPhase("error");
        return;
      }
      const ext = file.name.toLowerCase();
      if (!/\.(csv|xlsx|xls)$/.test(ext)) {
        setMessage("Please use a .csv, .xlsx, or .xls file.");
        setPhase("error");
        return;
      }
      setFileName(file.name);
      setPhase("parsing");
      try {
        const buf = await file.arrayBuffer();
        const { rows, error } = parseFileToRows(buf);
        if (error) {
          setMessage(error);
          setPhase("error");
          return;
        }
        setParsedRows(rows);
        await runPreview(rows);
      } catch (e) {
        setMessage(e instanceof Error ? e.message : "Could not read file");
        setPhase("error");
      }
    },
    [runPreview]
  );

  const handleCommit = useCallback(async () => {
    if (!parsedRows || !preview?.ok) return;
    setPhase("committing");
    setMessage(null);
    try {
      const res = await fetch("/api/admin/revenue/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "commit",
          month,
          year,
          publisher_id: publisherId,
          rows: parsedRows,
        }),
      });
      const data = await res.json();
      if (!res.ok || data.status !== "accepted") {
        const errText =
          (Array.isArray(data.errors) && data.errors.join("; ")) ||
          data.error ||
          "Upload failed";
        setMessage(errText);
        setPhase("ready");
        return;
      }
      setPhase("success");
      onSuccess?.();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Upload failed");
      setPhase("ready");
    }
  }, [month, year, publisherId, parsedRows, preview?.ok, onSuccess]);

  const handleClose = () => {
    reset();
    onClose();
  };

  if (!open) return null;

  const periodLabel = monthLabel(month, year);
  const canCommit =
    phase === "ready" && preview?.ok && parsedRows && preview.cleanedRowsCount > 0;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="upload-report-modal-title"
    >
      <div className="w-full max-w-7xl max-h-[95vh] overflow-y-auto rounded-lg bg-white p-6 sm:p-8 shadow-xl border border-gray-200">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <h2
              id="upload-report-modal-title"
              className="text-lg font-semibold text-gray-900"
            >
              Upload report
            </h2>
            <p className="text-sm text-gray-600 mt-1">
              <span className="font-medium text-gray-800">{publisherName}</span>
              {publicId ? (
                <span className="ml-2">
                  · Report ID:{" "}
                  <code className="text-xs bg-gray-100 px-1 rounded">{publicId}</code>
                  <button
                    type="button"
                    className="ml-2 text-blue-600 hover:underline text-xs"
                    onClick={() => void navigator.clipboard.writeText(publicId)}
                  >
                    Copy
                  </button>
                </span>
              ) : (
                <span className="ml-2 text-amber-800 text-xs">
                  (No Report ID on file — leave the Report ID column empty or ask support.)
                </span>
              )}
            </p>
            <p className="text-sm text-gray-700 mt-2">
              Period: <span className="font-medium">{periodLabel}</span>
            </p>
          </div>
          <button
            type="button"
            className="text-gray-500 hover:text-gray-800 text-xl leading-none"
            onClick={handleClose}
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <div className="mb-4 rounded-md border border-gray-200 overflow-hidden bg-white">
          <p className="text-sm leading-relaxed font-medium text-gray-800 bg-gray-50 px-4 py-3 border-b border-gray-200">
            Required layout (first sheet only — row 1 = column titles like Excel, data from row
            2). Dates use <strong>DD/MM/YYYY</strong> (example:{" "}
            <code className="bg-gray-100 px-1.5 py-0.5 rounded text-sm">17/03/2026</code>).
            Multiple rows for the same day are summed.
          </p>
          <div className="overflow-x-auto">
            <table
              className="border-collapse text-sm min-w-full"
              style={{ fontFamily: "Calibri, 'Segoe UI', system-ui, sans-serif" }}
            >
              <thead>
                <tr className="bg-[#4472C4] text-white">
                  {PUBLISHER_REPORT_HEADER_NAMES.map((h) => (
                    <th
                      key={h}
                      className="border border-gray-300 px-2.5 py-2 font-semibold text-left whitespace-nowrap"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr className="bg-[#D9E1F2]">
                  <td className="border border-gray-300 px-2.5 py-2 text-gray-800 whitespace-nowrap">
                    https://example.com/page
                  </td>
                  <td className="border border-gray-300 px-2.5 py-2 font-medium whitespace-nowrap">
                    17/03/2026
                  </td>
                  <td className="border border-gray-300 px-2.5 py-2 whitespace-nowrap">Banner</td>
                  <td className="border border-gray-300 px-2.5 py-2 whitespace-nowrap">Mobile</td>
                  <td className="border border-gray-300 px-2.5 py-2 text-right whitespace-nowrap">
                    12,500
                  </td>
                  <td className="border border-gray-300 px-2.5 py-2 text-right whitespace-nowrap">
                    42
                  </td>
                  <td className="border border-gray-300 px-2.5 py-2 text-right whitespace-nowrap">
                    1.25
                  </td>
                  <td className="border border-gray-300 px-2.5 py-2 text-right whitespace-nowrap">
                    0.34%
                  </td>
                  <td className="border border-gray-300 px-2.5 py-2 text-right whitespace-nowrap">
                    128.50
                  </td>
                  <td
                    className="border border-gray-300 px-2.5 py-2 font-mono text-xs max-w-[200px] truncate"
                    title={publicId ?? ""}
                  >
                    {publicId ?? "—"}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="text-sm leading-relaxed text-gray-700 px-4 py-3 border-t border-gray-200 bg-gray-50">
            <strong>Used for import:</strong> Date (column B), Impressions (E), Click (F), Net
            revenue (USD) (I). <strong>Must match month:</strong> {periodLabel}. If{" "}
            <strong>Report ID</strong> (column J) is filled, it must match the Report ID shown
            above. URL, Ad Format, Device, eCPM, and CTR Rate are optional for storage but can
            stay in the file for clarity.
          </p>
        </div>

        <div
          className={`mb-4 rounded-lg border-2 border-dashed px-4 py-8 text-center transition-colors ${
            dragActive ? "border-blue-400 bg-blue-50/50" : "border-gray-300 bg-gray-50/50"
          }`}
          onDragOver={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setDragActive(true);
          }}
          onDragLeave={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setDragActive(false);
          }}
          onDrop={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setDragActive(false);
            const f = e.dataTransfer.files?.[0];
            if (f) void processFile(f);
          }}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,.xlsx,.xls"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void processFile(f);
            }}
          />
          <p className="text-sm text-gray-700 mb-2">
            Drag and drop a file here, or{" "}
            <button
              type="button"
              className="text-blue-600 font-medium hover:underline"
              onClick={() => fileInputRef.current?.click()}
              disabled={phase === "parsing" || phase === "previewing" || phase === "committing"}
            >
              browse
            </button>
          </p>
          <p className="text-xs text-gray-500">
            .csv, .xlsx, .xls · max {MAX_FILE_BYTES / (1024 * 1024)} MB
          </p>
          {fileName && (
            <p className="text-xs text-gray-700 mt-2">
              Selected: <span className="font-medium">{fileName}</span>
            </p>
          )}
        </div>

        {(phase === "parsing" || phase === "previewing" || phase === "committing") && (
          <p className="text-sm text-gray-600 mb-3">
            {phase === "parsing" && "Reading file…"}
            {phase === "previewing" && "Validating on server…"}
            {phase === "committing" && "Uploading…"}
          </p>
        )}

        {message && phase !== "success" && (
          <div
            className={`mb-3 rounded-md px-3 py-2 text-sm ${
              phase === "error"
                ? "bg-red-50 text-red-800 border border-red-200"
                : "bg-amber-50 text-amber-900 border border-amber-200"
            }`}
          >
            {message}
          </div>
        )}

        {preview && (
          <div className="mb-4 rounded-lg border border-gray-200 bg-white p-4 text-sm">
            <h3 className="font-medium text-gray-900 mb-2">Preview</h3>
            <ul className="space-y-1 text-gray-700">
              <li>
                Rows in file: <strong>{preview.stats.total_input_rows}</strong>
              </li>
              <li>
                Valid data rows (before day totals):{" "}
                <strong>{preview.stats.valid_row_count_before_dedupe}</strong>
              </li>
              <li>
                Distinct days (after summing same-day rows):{" "}
                <strong>{preview.stats.unique_day_count}</strong>
              </li>
              <li>
                Date range:{" "}
                <strong>
                  {formatDateRangeLabel(
                    preview.stats.min_stat_date,
                    preview.stats.max_stat_date,
                    preview.stats.unique_day_count
                  )}
                </strong>
              </li>
            </ul>
            {preview.errors.length > 0 && (
              <div className="mt-3">
                <p className="text-red-700 font-medium text-xs mb-1">Errors</p>
                <ul className="list-disc ml-5 text-red-800 text-xs space-y-0.5 max-h-32 overflow-y-auto">
                  {preview.errors.map((err, i) => (
                    <li key={i}>{err}</li>
                  ))}
                </ul>
              </div>
            )}
            {preview.warnings.length > 0 && (
              <div className="mt-3">
                <p className="text-amber-800 font-medium text-xs mb-1">Warnings</p>
                <ul className="list-disc ml-5 text-amber-900 text-xs space-y-0.5">
                  {preview.warnings.map((w, i) => (
                    <li key={i}>{w}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {phase === "success" && (
          <div className="mb-4 rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800">
            Upload completed successfully.
          </div>
        )}

        <div className="flex flex-wrap justify-end gap-2">
          <button
            type="button"
            className="rounded border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
            onClick={handleClose}
          >
            {phase === "success" ? "Close" : "Cancel"}
          </button>
          {phase === "ready" && canCommit && (
            <button
              type="button"
              className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              onClick={() => void handleCommit()}
            >
              Upload now
            </button>
          )}
        </div>

        <p className="text-xs text-gray-500 mt-4">
          Import replaces existing daily stats for this publisher in the selected month
          with the dates in your file. Any row error blocks the whole import (same as
          before).
        </p>
      </div>
    </div>
  );
}
