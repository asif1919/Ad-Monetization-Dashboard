"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { ImportWizard } from "../import/import-wizard";

type TargetRow = {
  publisher_id: string;
  name: string;
  email: string;
  target_revenue: number;
  target_id: string | null;
};

type PayoutRow = {
  id: string;
  publisher_id: string;
  publisher_name: string;
  publisher_email: string;
  month: number;
  year: number;
  amount: number;
  status: string;
  paid_at: string | null;
};

const MONTHS = Array.from({ length: 12 }, (_, i) => i + 1);
const currentYear = new Date().getFullYear();
const YEARS = Array.from({ length: 6 }, (_, i) => currentYear - 2 + i);

export function RevenuePageClient({
  initialMonth,
  initialYear,
  configs,
}: {
  initialMonth: number;
  initialYear: number;
  configs: { month: number; year: number; real_data_imported_at: string | null }[];
}) {
  const router = useRouter();
  const [month, setMonth] = useState(initialMonth);
  const [year, setYear] = useState(initialYear);
  const [targets, setTargets] = useState<TargetRow[]>([]);
  const [payouts, setPayouts] = useState<PayoutRow[]>([]);
  const [realDataImportedAt, setRealDataImportedAt] = useState<string | null>(null);
  const [loadingTargets, setLoadingTargets] = useState(true);
  const [loadingPayouts, setLoadingPayouts] = useState(true);
  const [estimateLoading, setEstimateLoading] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [editTargets, setEditTargets] = useState<Record<string, string>>({});

  const loadTargets = useCallback(async () => {
    setLoadingTargets(true);
    try {
      const res = await fetch(
        `/api/admin/revenue/targets?month=${month}&year=${year}`
      );
      const data = await res.json();
      if (res.ok) {
        setTargets(data.targets ?? []);
        setRealDataImportedAt(data.real_data_imported_at ?? null);
        setEditTargets({});
      }
    } finally {
      setLoadingTargets(false);
    }
  }, [month, year]);

  const loadPayouts = useCallback(async () => {
    setLoadingPayouts(true);
    try {
      const res = await fetch(
        `/api/admin/revenue/payouts?month=${month}&year=${year}`
      );
      const data = await res.json();
      if (res.ok) setPayouts(data.payouts ?? []);
    } finally {
      setLoadingPayouts(false);
    }
  }, [month, year]);

  useEffect(() => {
    loadTargets();
  }, [loadTargets]);
  useEffect(() => {
    loadPayouts();
  }, [loadPayouts]);

  async function saveTarget(publisherId: string, value: string) {
    const num = parseFloat(value);
    if (Number.isNaN(num) || num < 0) return;
    setSavingId(publisherId);
    try {
      const res = await fetch("/api/admin/revenue/targets", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          month,
          year,
          publisher_id: publisherId,
          target_revenue: num,
        }),
      });
      if (res.ok) {
        setEditTargets((prev) => {
          const next = { ...prev };
          delete next[publisherId];
          return next;
        });
        await loadTargets();
      }
    } finally {
      setSavingId(null);
    }
  }

  async function generateEstimates() {
    setEstimateLoading(true);
    try {
      const res = await fetch("/api/admin/revenue/estimate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ month, year }),
      });
      if (res.ok) {
        await loadTargets();
        router.refresh();
      }
    } finally {
      setEstimateLoading(false);
    }
  }

  async function markPayoutPaid(payoutId: string) {
    const res = await fetch("/api/admin/revenue/payouts", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ payout_id: payoutId, status: "paid" }),
    });
    if (res.ok) {
      await loadPayouts();
      router.refresh();
    }
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center gap-4">
        <h1 className="text-2xl font-semibold text-gray-900">
          Revenue & Payouts
        </h1>
        <div className="flex items-center gap-2">
          <label className="text-sm text-gray-700">Month</label>
          <select
            value={month}
            onChange={(e) => setMonth(Number(e.target.value))}
            className="rounded border border-gray-300 px-3 py-2 bg-white text-gray-900"
          >
            {MONTHS.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
          <label className="text-sm text-gray-700">Year</label>
          <select
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
            className="rounded border border-gray-300 px-3 py-2 bg-white text-gray-900"
          >
            {YEARS.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </div>
      </div>

      <p className="text-sm text-gray-600 max-w-2xl">
        Set per-publisher monthly targets to drive estimated daily stats until
        you upload real data. Uploading real data for a month replaces
        estimated data for that month. Use &quot;Generate estimates&quot; after
        editing targets to refresh estimated daily stats.
      </p>

      {/* A. Per-publisher monthly targets */}
      <section className="rounded-lg border border-gray-200 bg-white overflow-hidden">
        <div className="px-4 py-3 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
          <h2 className="font-medium text-gray-900">
            Per-publisher monthly targets
          </h2>
          <button
            type="button"
            onClick={generateEstimates}
            disabled={estimateLoading}
            className="rounded bg-blue-600 px-4 py-2 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
          >
            {estimateLoading ? "Generating…" : "Generate estimates"}
          </button>
        </div>
        {loadingTargets ? (
          <p className="p-4 text-gray-600">Loading…</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="text-left p-3">Publisher</th>
                  <th className="text-left p-3">Email</th>
                  <th className="text-left p-3">Monthly target (USD)</th>
                  <th className="text-left p-3">Real data imported</th>
                </tr>
              </thead>
              <tbody>
                {targets.map((t) => (
                  <tr key={t.publisher_id} className="border-b border-gray-100">
                    <td className="p-3 font-medium">{t.name}</td>
                    <td className="p-3 text-gray-600">{t.email}</td>
                    <td className="p-3">
                      <input
                        type="number"
                        min={0}
                        step={0.01}
                        value={
                          editTargets[t.publisher_id] ??
                          (t.target_revenue > 0
                            ? String(t.target_revenue)
                            : "")
                        }
                        onChange={(e) =>
                          setEditTargets((prev) => ({
                            ...prev,
                            [t.publisher_id]: e.target.value,
                          }))
                        }
                        onBlur={() => {
                          const v =
                            editTargets[t.publisher_id] ??
                            (t.target_revenue > 0
                              ? String(t.target_revenue)
                              : "");
                          if (v !== "" && parseFloat(v) !== t.target_revenue) {
                            saveTarget(t.publisher_id, v);
                          }
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            const v = editTargets[t.publisher_id];
                            if (v != null) saveTarget(t.publisher_id, v);
                          }
                        }}
                        placeholder="0"
                        className="w-28 rounded border border-gray-300 px-2 py-1 bg-white text-gray-900"
                      />
                      {savingId === t.publisher_id && (
                        <span className="ml-2 text-gray-500 text-xs">
                          Saving…
                        </span>
                      )}
                    </td>
                    <td className="p-3 text-gray-600">
                      {realDataImportedAt
                        ? new Date(realDataImportedAt).toLocaleString()
                        : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* B. Real data import (Excel) */}
      <section className="rounded-lg border border-gray-200 bg-white overflow-hidden">
        <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
          <h2 className="font-medium text-gray-900">Import real data (Excel)</h2>
        </div>
        <div className="p-4">
          <ImportWizard configs={configs} />
        </div>
      </section>

      {/* C. Payouts overview */}
      <section className="rounded-lg border border-gray-200 bg-white overflow-hidden">
        <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
          <h2 className="font-medium text-gray-900">Payouts</h2>
        </div>
        {loadingPayouts ? (
          <p className="p-4 text-gray-600">Loading…</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="text-left p-3">Publisher</th>
                  <th className="text-left p-3">Amount</th>
                  <th className="text-left p-3">Status</th>
                  <th className="text-left p-3">Paid at</th>
                  <th className="text-left p-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {payouts.map((p) => (
                  <tr key={p.id} className="border-b border-gray-100">
                    <td className="p-3">
                      <span className="font-medium">{p.publisher_name}</span>
                      <br />
                      <span className="text-gray-600 text-xs">
                        {p.publisher_email}
                      </span>
                    </td>
                    <td className="p-3">${p.amount.toFixed(2)}</td>
                    <td className="p-3">
                      <span
                        className={
                          p.status === "paid"
                            ? "text-green-600"
                            : "text-amber-600"
                        }
                      >
                        {p.status}
                      </span>
                    </td>
                    <td className="p-3">
                      {p.paid_at
                        ? new Date(p.paid_at).toLocaleDateString()
                        : "—"}
                    </td>
                    <td className="p-3">
                      {p.status === "paid" ? (
                        <span className="text-gray-500">—</span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => markPayoutPaid(p.id)}
                          className="text-blue-600 hover:underline"
                        >
                          Mark paid
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {payouts.length === 0 && (
              <p className="p-4 text-gray-600">
                No payouts for this month. Payouts are created when you
                generate invoices or from revenue data.
              </p>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
