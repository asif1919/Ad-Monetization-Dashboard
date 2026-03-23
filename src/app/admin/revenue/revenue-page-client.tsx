"use client";

import { useState, useEffect, useCallback, useRef, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { UploadReportModal } from "./upload-report-modal";
import {
  getFirstActiveStatDayInMonth,
  resolvePublisherStatRange,
} from "@/lib/estimates";

type TargetRow = {
  publisher_id: string;
  name: string;
  email: string;
  public_id?: string | null;
  created_at?: string;
  target_revenue: number;
  target_id: string | null;
  upload_status?: "pending" | "uploaded" | "failed";
  estimate_status?: "none" | "generated" | "skipped_real_data";
};

function daysInMonth(year: number, month: number) {
  return new Date(year, month, 0).getDate();
}

function monthName(m: number) {
  return new Date(2000, m - 1, 1).toLocaleString(undefined, { month: "long" });
}

function formatDayRangeLabel(
  year: number,
  month: number,
  startDay: number,
  endDay: number
) {
  const a = `${monthName(month)} ${startDay}, ${year}`;
  const b = `${monthName(month)} ${endDay}, ${year}`;
  return startDay === endDay ? a : `${a} – ${b}`;
}

const MONTHS = Array.from({ length: 12 }, (_, i) => i + 1);
const currentYear = new Date().getFullYear();
const YEARS = Array.from({ length: 6 }, (_, i) => currentYear - 2 + i);

function RevenuePageClientInner({
  initialMonth,
  initialYear,
}: {
  initialMonth: number;
  initialYear: number;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [month, setMonth] = useState(initialMonth);
  const [year, setYear] = useState(initialYear);
  const [targets, setTargets] = useState<TargetRow[]>([]);
  const [realDataImportedAt, setRealDataImportedAt] = useState<string | null>(null);
  const [loadingTargets, setLoadingTargets] = useState(true);
  const [estimateLoading, setEstimateLoading] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [editTargets, setEditTargets] = useState<Record<string, string>>({});
  const [estimateModal, setEstimateModal] = useState<
    null | { row: TargetRow; startDay: number; endDay: number }
  >(null);
  const [uploadModal, setUploadModal] = useState<TargetRow | null>(null);
  const openedUploadFromUrlRef = useRef(false);

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

  useEffect(() => {
    loadTargets();
  }, [loadTargets]);

  const uploadFromUrl = searchParams.get("upload");
  useEffect(() => {
    if (
      openedUploadFromUrlRef.current ||
      !uploadFromUrl ||
      loadingTargets ||
      targets.length === 0
    ) {
      return;
    }
    const row = targets.find((t) => t.publisher_id === uploadFromUrl);
    if (row) {
      openedUploadFromUrlRef.current = true;
      setUploadModal(row);
      const next = new URLSearchParams(searchParams.toString());
      next.delete("upload");
      const q = next.toString();
      router.replace(
        q ? `/admin/revenue?${q}` : "/admin/revenue",
        { scroll: false }
      );
    }
  }, [uploadFromUrl, loadingTargets, targets, searchParams, router]);

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

  function openGenerateSingleModal(row: TargetRow) {
    const dim = daysInMonth(year, month);
    const r = resolvePublisherStatRange(row.created_at, year, month, null, null);
    if (!r) {
      window.alert(
        "This publisher has no active days in the selected month (created after this month)."
      );
      return;
    }
    setEstimateModal({ row, startDay: r.first, endDay: r.last });
  }

  function clampModalDays(
    start: number,
    end: number,
    dim: number
  ): { startDay: number; endDay: number } {
    let s = Math.max(1, Math.min(dim, Math.floor(start)));
    let e = Math.max(1, Math.min(dim, Math.floor(end)));
    if (s > e) [s, e] = [e, s];
    return { startDay: s, endDay: e };
  }

  async function confirmGenerateFromModal() {
    if (!estimateModal) return;
    const modal = estimateModal;
    const dim = daysInMonth(year, month);
    const { startDay, endDay } = clampModalDays(
      modal.startDay,
      modal.endDay,
      dim
    );

    setEstimateLoading(true);
    setEstimateModal(null);
    try {
      const row = modal.row;
      const v = editTargets[row.publisher_id];
      if (v != null && v !== "" && parseFloat(v) !== row.target_revenue) {
        await saveTarget(row.publisher_id, v);
      }
      const res = await fetch("/api/admin/revenue/estimate/publisher", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          publisher_id: row.publisher_id,
          month,
          year,
          start_day: startDay,
          end_day: endDay,
        }),
      });
      if (res.ok) {
        await loadTargets();
        router.refresh();
      }
    } finally {
      setEstimateLoading(false);
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
            onChange={(e) => {
              const nextMonth = Number(e.target.value);
              setMonth(nextMonth);
              router.push(`/admin/revenue?month=${nextMonth}&year=${year}`);
            }}
            className="rounded border border-gray-300 px-3 py-2 bg-white text-gray-900"
          >
            {MONTHS.map((m) => (
              <option key={m} value={m}>
                {monthName(m)}
              </option>
            ))}
          </select>
          <label className="text-sm text-gray-700">Year</label>
          <select
            value={year}
            onChange={(e) => {
              const nextYear = Number(e.target.value);
              setYear(nextYear);
              router.push(`/admin/revenue?month=${month}&year=${nextYear}`);
            }}
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

      

      {/* Per-publisher monthly targets */}
      <section className="rounded-lg border border-gray-200 bg-white overflow-hidden">
        <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
          <h2 className="font-medium text-gray-900">
            Per-publisher monthly targets
          </h2>
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
                  <th className="text-left p-3">Report ID</th>
                  <th className="text-left p-3">Monthly target (USD)</th>
                  <th className="text-left p-3">Upload report</th>
                  <th className="text-left p-3">Upload status</th>
                  <th className="text-left p-3">Estimate</th>
                  <th className="text-left p-3">Estimate status</th>
                </tr>
              </thead>
              <tbody>
                {targets.map((t) => {
                  const editedTarget = editTargets[t.publisher_id];
                  const effectiveTargetRevenue =
                    editedTarget != null && editedTarget !== ""
                      ? Number(editedTarget)
                      : Number(t.target_revenue);
                  const generateDisabledReason =
                    t.estimate_status === "skipped_real_data"
                      ? "Disabled: real data is already imported for this month."
                      : !Number.isFinite(effectiveTargetRevenue) || effectiveTargetRevenue <= 0
                        ? "Disabled: monthly target must be greater than 0."
                        : null;

                  return (
                  <tr key={t.publisher_id} className="border-b border-gray-100">
                    <td className="p-3 font-medium">{t.name}</td>
                    <td className="p-3 text-gray-600">{t.email}</td>
                    <td className="p-3 text-xs text-gray-700">
                      {t.public_id ?? "—"}
                    </td>
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
                        placeholder="0"
                        className="w-28 rounded border border-gray-300 px-2 py-1 bg-white text-gray-900"
                      />
                      {savingId === t.publisher_id && (
                        <span className="ml-2 text-gray-500 text-xs">
                          Saving…
                        </span>
                      )}
                    </td>
                    <td className="p-3">
                      <button
                        type="button"
                        className="text-blue-600 hover:underline text-xs"
                        onClick={() => setUploadModal(t)}
                      >
                        Upload report
                      </button>
                    </td>
                    <td className="p-3 text-xs">
                      {t.upload_status === "uploaded" && (
                        <span className="inline-flex rounded-full bg-green-50 px-2 py-0.5 text-green-700">
                          Uploaded
                        </span>
                      )}
                      {t.upload_status === "failed" && (
                        <span className="inline-flex rounded-full bg-red-50 px-2 py-0.5 text-red-700">
                          Failed
                        </span>
                      )}
                      {(!t.upload_status || t.upload_status === "pending") && (
                        <span className="inline-flex rounded-full bg-gray-50 px-2 py-0.5 text-gray-700">
                          Pending
                        </span>
                      )}
                    </td>
                    <td className="p-3">
                      <button
                        type="button"
                        className="text-blue-600 hover:underline text-xs disabled:opacity-50"
                        disabled={!!generateDisabledReason}
                        title={generateDisabledReason ?? "Generate estimate"}
                        onClick={() => openGenerateSingleModal(t)}
                      >
                        Generate
                      </button>
                      {generateDisabledReason && (
                        <p className="mt-1 text-[11px] text-gray-500">
                          {generateDisabledReason}
                        </p>
                      )}
                    </td>
                    <td className="p-3 text-xs text-gray-700">
                      {t.estimate_status === "generated" && "Generated"}
                      {t.estimate_status === "skipped_real_data" &&
                        "Skipped (real data imported)"}
                      {(!t.estimate_status || t.estimate_status === "none") &&
                        "Not generated"}
                    </td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {uploadModal && (
        <UploadReportModal
          open={!!uploadModal}
          onClose={() => setUploadModal(null)}
          onSuccess={() => {
            void loadTargets();
            router.refresh();
          }}
          publisherId={uploadModal.publisher_id}
          publisherName={uploadModal.name}
          publicId={uploadModal.public_id ?? null}
          month={month}
          year={year}
        />
      )}

      {estimateModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="estimate-modal-title"
        >
          <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl border border-gray-200">
            <h2
              id="estimate-modal-title"
              className="text-lg font-semibold text-gray-900 mb-1"
            >
              Generate estimates — {estimateModal.row.name}
            </h2>
            <p className="text-sm text-gray-600 mb-4">
              {monthName(month)} {year} · Adjust the day range if needed. The
              full monthly target is spread across the selected days.
              {estimateModal.row.created_at && (
                <>
                  {" "}
                  Earliest day allowed by join date:{" "}
                  <span className="font-medium text-gray-800">
                    {getFirstActiveStatDayInMonth(
                      estimateModal.row.created_at,
                      year,
                      month
                    )}
                  </span>
                  .
                </>
              )}
            </p>

            <div className="rounded-md bg-gray-50 border border-gray-100 px-3 py-2 mb-4 text-sm text-gray-800">
              <span className="text-gray-500">Range: </span>
              {formatDayRangeLabel(
                year,
                month,
                estimateModal.startDay,
                estimateModal.endDay
              )}
            </div>

            <div className="grid grid-cols-2 gap-4 mb-6">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Start day (1–{daysInMonth(year, month)})
                </label>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    className="rounded border border-gray-300 px-2 py-1 text-sm hover:bg-gray-50"
                    onClick={() =>
                      setEstimateModal((m) =>
                        m
                          ? {
                              ...m,
                              startDay: Math.max(
                                1,
                                m.startDay - 1
                              ),
                            }
                          : m
                      )
                    }
                  >
                    −
                  </button>
                  <input
                    type="number"
                    min={1}
                    max={daysInMonth(year, month)}
                    value={estimateModal.startDay}
                    onChange={(e) => {
                      const n = parseInt(e.target.value, 10);
                      if (Number.isNaN(n)) return;
                      setEstimateModal((m) =>
                        m ? { ...m, startDay: n } : m
                      );
                    }}
                    className="w-full rounded border border-gray-300 px-2 py-1 text-sm text-center"
                  />
                  <button
                    type="button"
                    className="rounded border border-gray-300 px-2 py-1 text-sm hover:bg-gray-50"
                    onClick={() =>
                      setEstimateModal((m) =>
                        m
                          ? {
                              ...m,
                              startDay: Math.min(
                                daysInMonth(year, month),
                                m.startDay + 1
                              ),
                            }
                          : m
                      )
                    }
                  >
                    +
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  End day (1–{daysInMonth(year, month)})
                </label>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    className="rounded border border-gray-300 px-2 py-1 text-sm hover:bg-gray-50"
                    onClick={() =>
                      setEstimateModal((m) =>
                        m
                          ? {
                              ...m,
                              endDay: Math.max(1, m.endDay - 1),
                            }
                          : m
                      )
                    }
                  >
                    −
                  </button>
                  <input
                    type="number"
                    min={1}
                    max={daysInMonth(year, month)}
                    value={estimateModal.endDay}
                    onChange={(e) => {
                      const n = parseInt(e.target.value, 10);
                      if (Number.isNaN(n)) return;
                      setEstimateModal((m) =>
                        m ? { ...m, endDay: n } : m
                      );
                    }}
                    className="w-full rounded border border-gray-300 px-2 py-1 text-sm text-center"
                  />
                  <button
                    type="button"
                    className="rounded border border-gray-300 px-2 py-1 text-sm hover:bg-gray-50"
                    onClick={() =>
                      setEstimateModal((m) =>
                        m
                          ? {
                              ...m,
                              endDay: Math.min(
                                daysInMonth(year, month),
                                m.endDay + 1
                              ),
                            }
                          : m
                      )
                    }
                  >
                    +
                  </button>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <button
                type="button"
                className="rounded border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                onClick={() => setEstimateModal(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={estimateLoading}
                className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                onClick={() => void confirmGenerateFromModal()}
              >
                {estimateLoading ? "Generating…" : "Generate"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export function RevenuePageClient(props: {
  initialMonth: number;
  initialYear: number;
}) {
  return (
    <Suspense fallback={<p className="text-gray-600 p-4">Loading…</p>}>
      <RevenuePageClientInner {...props} />
    </Suspense>
  );
}
