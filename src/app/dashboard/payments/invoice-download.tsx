"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { currentAndPreviousCalendarMonthUtc } from "@/lib/invoice-month-window";
import { monthKey } from "@/lib/invoice-real-months";

type InvoiceRow = { id: string; month: number; year: number; file_path: string | null };

function monthYearLabel(month: number, year: number) {
  return new Date(year, month - 1, 1).toLocaleString(undefined, {
    month: "long",
    year: "numeric",
  });
}

export function InvoiceDownload() {
  const [invoices, setInvoices] = useState<InvoiceRow[]>([]);
  const [eligibilityByMonthKey, setEligibilityByMonthKey] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);
  const [genOk, setGenOk] = useState<string | null>(null);

  const periodOptions = useMemo(() => {
    const [cur, prev] = currentAndPreviousCalendarMonthUtc();
    return [
      { month: cur.month, year: cur.year, tag: "Current month" },
      { month: prev.month, year: prev.year, tag: "Previous month" },
    ];
  }, []);
  const [selectedPeriod, setSelectedPeriod] = useState(() => {
    const [cur] = currentAndPreviousCalendarMonthUtc();
    return `${cur.year}-${String(cur.month).padStart(2, "0")}`;
  });

  const loadInvoices = useCallback(() => {
    fetch("/api/dashboard/invoices")
      .then((r) => r.json())
      .then((data) => {
        setInvoices(data.invoices ?? []);
        setEligibilityByMonthKey(
          typeof data.eligibilityByMonthKey === "object" && data.eligibilityByMonthKey !== null
            ? data.eligibilityByMonthKey
            : {}
        );
      })
      .catch(() => {
        setInvoices([]);
        setEligibilityByMonthKey({});
      });
  }, []);

  useEffect(() => {
    loadInvoices();
  }, [loadInvoices]);

  const selectedMy = useMemo(() => {
    const [y, m] = selectedPeriod.split("-").map(Number);
    return { year: y, month: m };
  }, [selectedPeriod]);

  const selectedMonthKey = monthKey(selectedMy.year, selectedMy.month);
  const hasStatsForSelected = eligibilityByMonthKey[selectedMonthKey] === true;
  const invoiceForSelected = useMemo(
    () => invoices.find((inv) => inv.month === selectedMy.month && inv.year === selectedMy.year),
    [invoices, selectedMy.month, selectedMy.year]
  );
  const hasPdfForSelected = Boolean(invoiceForSelected?.file_path);

  async function generateInvoice() {
    setGenError(null);
    setGenOk(null);
    setGenerating(true);
    try {
      const res = await fetch("/api/dashboard/invoices/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ month: selectedMy.month, year: selectedMy.year }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setGenError(typeof data.error === "string" ? data.error : "Could not create invoice.");
        return;
      }
      setGenOk("Invoice PDF is ready. Download it from the list below.");
      loadInvoices();
    } finally {
      setGenerating(false);
    }
  }

  async function download(path: string) {
    setLoading(true);
    try {
      const res = await fetch(`/api/dashboard/invoices/signed-url?path=${encodeURIComponent(path)}`);
      const data = await res.json();
      if (!res.ok || !data.url) throw new Error("Failed to get download link");
      window.open(data.url, "_blank");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4">
      <p className="text-sm text-gray-600 mb-3">
        Your invoice is a <strong>PDF built from your daily traffic stats</strong> for that month. When stats
        exist for a month, you can generate the PDF here and download it. Only the <strong>current</strong> and{" "}
        <strong>previous</strong> calendar month (UTC) are available.
      </p>

      <div className="flex flex-wrap items-end gap-2 mb-3 pb-4 border-b border-gray-100">
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Month</label>
          <select
            value={selectedPeriod}
            onChange={(e) => {
              setSelectedPeriod(e.target.value);
              setGenError(null);
              setGenOk(null);
            }}
            className="rounded border border-gray-300 px-3 py-2 text-sm bg-white text-gray-900 min-w-[14rem]"
          >
            {periodOptions.map((o) => {
              const v = `${o.year}-${String(o.month).padStart(2, "0")}`;
              return (
                <option key={v} value={v}>
                  {monthYearLabel(o.month, o.year)} ({o.tag})
                </option>
              );
            })}
          </select>
        </div>
        <button
          type="button"
          onClick={() => void generateInvoice()}
          disabled={generating || !hasStatsForSelected}
          className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {generating ? "Building PDF…" : hasPdfForSelected ? "Regenerate PDF" : "Generate invoice PDF"}
        </button>
      </div>

      <p className="text-sm mb-4" aria-live="polite">
        {!hasStatsForSelected && (
          <span className="text-amber-800">
            No daily stats for this month yet — the invoice PDF cannot be created until stats exist for that period.
          </span>
        )}
        {hasStatsForSelected && !hasPdfForSelected && (
          <span className="text-green-800">Stats for this month are ready — generate the PDF to download your invoice.</span>
        )}
        {hasStatsForSelected && hasPdfForSelected && (
          <span className="text-gray-700">
            PDF for this month is listed below — use <strong>Download PDF</strong>.
          </span>
        )}
      </p>

      {genError && (
        <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded px-3 py-2 mb-3">
          {genError}
        </p>
      )}
      {genOk && (
        <p className="text-sm text-green-800 bg-green-50 border border-green-200 rounded px-3 py-2 mb-3">
          {genOk}
        </p>
      )}

      <h3 className="text-sm font-medium text-gray-900 mb-2">Invoices you can download (PDF)</h3>
      <ul className="space-y-2">
        {invoices.map((inv) => (
          <li key={inv.id} className="flex items-center justify-between gap-2">
            <span>
              {inv.month}/{inv.year}
            </span>
            {inv.file_path ? (
              <button
                type="button"
                onClick={() => download(inv.file_path!)}
                disabled={loading}
                className="text-blue-600 hover:underline text-sm disabled:opacity-50 shrink-0"
              >
                Download PDF
              </button>
            ) : (
              <span className="text-gray-600 text-sm">No PDF</span>
            )}
          </li>
        ))}
      </ul>
      {invoices.length === 0 && (
        <p className="text-gray-700 text-sm mt-2">
          No PDFs yet. When daily stats exist for a month, generate the invoice above to add it here.
        </p>
      )}
    </div>
  );
}
