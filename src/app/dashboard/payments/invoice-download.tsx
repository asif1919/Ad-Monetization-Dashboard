"use client";

import { useState, useEffect } from "react";

export function InvoiceDownload({ publisherId }: { publisherId: string }) {
  const [invoices, setInvoices] = useState<{ id: string; month: number; year: number; file_path: string | null }[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch("/api/dashboard/invoices")
      .then((r) => r.json())
      .then((data) => setInvoices(data.invoices ?? []))
      .catch(() => setInvoices([]));
  }, []);

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
      <ul className="space-y-2">
        {invoices.map((inv) => (
          <li key={inv.id} className="flex items-center justify-between">
            <span>
              {inv.month}/{inv.year}
            </span>
            {inv.file_path ? (
              <button
                type="button"
                onClick={() => download(inv.file_path!)}
                disabled={loading}
                className="text-blue-600 hover:underline text-sm disabled:opacity-50"
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
        <p className="text-gray-700 text-sm">No invoices yet.</p>
      )}
    </div>
  );
}
