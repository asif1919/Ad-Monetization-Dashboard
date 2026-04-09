"use client";

import { useState, useEffect, useCallback, useRef, Suspense } from "react";
import { useRouter } from "next/navigation";
import { getFrozenPrefixStatBounds } from "@/lib/estimate-partial";
import { resolvePublisherStatRange } from "@/lib/estimates";

type TargetRow = {
  publisher_id: string;
  name: string;
  email: string;
  public_id?: string | null;
  created_at?: string;
  target_revenue: number;
  target_id: string | null;
  estimate_status?: "none" | "generated";
};

type EstimateModalOpen = {
  row: TargetRow;
  startDay: number;
  endDay: number;
  preserveFirstNDays: number;
  usePreserve: boolean;
  /** Full-month target (USD) — used in “whole month” mode */
  monthlyTargetInput: string;
  /** Total $ to spread on days after the locked-in period (partial mode) */
  restOfMonthAmountInput: string;
  /** Sum of revenue on locked-in days (from server) */
  frozenSumKnown: number | null;
  modalInitLoading?: boolean;
  previewLoading?: boolean;
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
  const [month, setMonth] = useState(initialMonth);
  const [year, setYear] = useState(initialYear);
  const [targets, setTargets] = useState<TargetRow[]>([]);
  const [loadingTargets, setLoadingTargets] = useState(true);
  const [estimateLoading, setEstimateLoading] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [editTargets, setEditTargets] = useState<Record<string, string>>({});
  const [estimateModal, setEstimateModal] = useState<EstimateModalOpen | null>(
    null
  );
  /** Cancels an in-flight partial-stats load when a new one starts (avoids duplicate GETs). */
  const partialStatsLoadAbortRef = useRef<AbortController | null>(null);
  /** Cancels in-flight preserve-preview when the “through day” field changes quickly. */
  const preservePreviewAbortRef = useRef<AbortController | null>(null);

  const loadTargets = useCallback(async () => {
    setLoadingTargets(true);
    try {
      const res = await fetch(
        `/api/admin/revenue/targets?month=${month}&year=${year}`
      );
      const data = await res.json();
      if (res.ok) {
        setTargets(data.targets ?? []);
        setEditTargets({});
      }
    } finally {
      setLoadingTargets(false);
    }
  }, [month, year]);

  useEffect(() => {
    loadTargets();
  }, [loadTargets]);

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

  const activatePartialFromStats = useCallback(
    async (row: TargetRow, currentMonthlyInput: string) => {
      const pid = row.publisher_id;
      const dim = daysInMonth(year, month);

      const log = (step: string, extra?: Record<string, unknown>) => {
        console.info(`[revenue/partial-load] ${step}`, {
          publisher_id: `${pid.slice(0, 8)}…`,
          month,
          year,
          daysInMonth: dim,
          ...extra,
        });
      };

      partialStatsLoadAbortRef.current?.abort();
      preservePreviewAbortRef.current?.abort();
      const ac = new AbortController();
      partialStatsLoadAbortRef.current = ac;

      setEstimateModal((m) =>
        m?.row.publisher_id === pid ? { ...m, modalInitLoading: true } : m
      );
      try {
        const res = await fetch(
          `/api/admin/revenue/estimate/publisher-covered-days?publisher_id=${encodeURIComponent(
            pid
          )}&month=${month}&year=${year}`,
          { credentials: "include", signal: ac.signal }
        );
        const raw = await res.text();
        let data: {
          maxDay?: number | null;
          rowCount?: number;
          coversFullMonth?: boolean;
          daysInMonth?: number;
        } = {};
        try {
          data = raw ? JSON.parse(raw) : {};
        } catch {
          /* ignore */
        }
        const maxDay =
          typeof data.maxDay === "number" && Number.isFinite(data.maxDay)
            ? data.maxDay
            : null;

        const coversFullMonth =
          data.coversFullMonth === true ||
          (maxDay != null && maxDay >= dim);

        log("covered-days ok", {
          httpOk: res.ok,
          maxDay,
          rowCount: data.rowCount,
          coversFullMonth,
        });

        if (maxDay == null) {
          log("branch: no_rows_for_month");
          window.alert(
            "There’s no estimate data for this month yet. Generate the full month first, then you can update only the later days."
          );
          setEstimateModal((m) =>
            m?.row.publisher_id === pid
              ? { ...m, modalInitLoading: false }
              : m
          );
          return;
        }

        /** N = last calendar day to keep frozen; tail starts at N+1. */
        let preserveN: number;
        if (maxDay < dim) {
          preserveN = maxDay;
          log("branch: partial_month_stats", {
            preserveN,
            reason: "maxDay < daysInMonth",
          });
        } else if (dim > 1) {
          preserveN = dim - 1;
          log("branch: full_month_stats", {
            preserveN,
            reason:
              "stats through last day of month — default N = daysInMonth - 1 so at least one day can be regenerated; lower N to keep fewer days",
          });
        } else {
          log("branch: single_calendar_day_month");
          window.alert(
            "This month only has one day of data. Use “Rebuild the whole month” to replace it."
          );
          setEstimateModal((m) =>
            m?.row.publisher_id === pid
              ? { ...m, modalInitLoading: false }
              : m
          );
          return;
        }

        const pRes = await fetch(
          `/api/admin/revenue/estimate/preserve-preview?publisher_id=${encodeURIComponent(
            pid
          )}&month=${month}&year=${year}&preserve_first_n_days=${preserveN}`,
          { credentials: "include", signal: ac.signal }
        );
        const pRaw = await pRes.text();
        let p: { ok?: boolean; frozenSum?: number; error?: string } = {};
        try {
          p = pRaw ? JSON.parse(pRaw) : {};
        } catch {
          /* ignore */
        }
        log("preserve-preview", {
          httpOk: pRes.ok,
          preserveN,
          previewOk: p.ok,
          frozenSum: p.frozenSum,
          err: p.error,
        });

        if (!pRes.ok || !p.ok) {
          window.alert(
            typeof p.error === "string"
              ? p.error
              : "Could not load amounts for partial update. Try again."
          );
          setEstimateModal((m) =>
            m?.row.publisher_id === pid
              ? { ...m, modalInitLoading: false }
              : m
          );
          return;
        }

        const monthly =
          parseFloat(currentMonthlyInput) ||
          (row.target_revenue > 0 ? row.target_revenue : 0);
        const frozen = Number(p.frozenSum ?? 0);
        const tail = Math.max(0, monthly - frozen);

        setEstimateModal((m) => {
          if (!m || m.row.publisher_id !== pid) return m;
          return {
            ...m,
            usePreserve: true,
            preserveFirstNDays: preserveN,
            frozenSumKnown: frozen,
            restOfMonthAmountInput: tail.toFixed(2),
            monthlyTargetInput:
              monthly > 0 ? String(monthly) : m.monthlyTargetInput,
            modalInitLoading: false,
          };
        });
        log("modal: partial mode applied", { preserveN, frozen, tail });
      } catch (e) {
        const aborted =
          (e instanceof DOMException || e instanceof Error) &&
          (e as { name?: string }).name === "AbortError";
        if (aborted) {
          console.info(
            "[revenue/partial-load] aborted (newer load started or navigation)"
          );
          return;
        }
        console.error("[revenue/partial-load] error", e);
        setEstimateModal((m) =>
          m?.row.publisher_id === pid
            ? { ...m, modalInitLoading: false }
            : m
        );
      }
    },
    [month, year]
  );

  function openGenerateSingleModal(row: TargetRow) {
    const r = resolvePublisherStatRange(row.created_at, year, month, null, null);
    if (!r) {
      window.alert(
        "This publisher has no active days in the selected month (created after this month)."
      );
      return;
    }
    const edited = editTargets[row.publisher_id];
    const monthlyTargetInput =
      edited != null && edited !== ""
        ? edited
        : row.target_revenue > 0
          ? String(row.target_revenue)
          : "";

    setEstimateModal({
      row,
      startDay: r.first,
      endDay: r.last,
      preserveFirstNDays: 7,
      usePreserve: false,
      monthlyTargetInput,
      restOfMonthAmountInput: "",
      frozenSumKnown: null,
      modalInitLoading: true,
      previewLoading: false,
    });

    void activatePartialFromStats(row, monthlyTargetInput);
  }

  const refreshPreservePreview = useCallback(
    async (publisherId: string, lastDayKept: number) => {
      const dim = daysInMonth(year, month);
      const n = Math.max(1, Math.min(dim, Math.floor(lastDayKept)));

      preservePreviewAbortRef.current?.abort();
      const ac = new AbortController();
      preservePreviewAbortRef.current = ac;

      setEstimateModal((m) =>
        m?.row.publisher_id === publisherId
          ? { ...m, previewLoading: true, preserveFirstNDays: n }
          : m
      );
      try {
        const res = await fetch(
          `/api/admin/revenue/estimate/preserve-preview?publisher_id=${encodeURIComponent(
            publisherId
          )}&month=${month}&year=${year}&preserve_first_n_days=${n}`,
          { credentials: "include", signal: ac.signal }
        );
        const raw = await res.text();
        let p: { ok?: boolean; frozenSum?: number } = {};
        try {
          p = raw ? JSON.parse(raw) : {};
        } catch {
          /* ignore */
        }
        setEstimateModal((m) => {
          if (!m || m.row.publisher_id !== publisherId) return m;
          if (!res.ok || !p.ok) {
            return { ...m, previewLoading: false, frozenSumKnown: null };
          }
          const frozen = Number(p.frozenSum ?? 0);
          return {
            ...m,
            previewLoading: false,
            frozenSumKnown: frozen,
            preserveFirstNDays: n,
          };
        });
      } catch (e) {
        const aborted =
          (e instanceof DOMException || e instanceof Error) &&
          (e as { name?: string }).name === "AbortError";
        if (aborted) return;
        setEstimateModal((m) =>
          m?.row.publisher_id === publisherId
            ? { ...m, previewLoading: false }
            : m
        );
      }
    },
    [month, year]
  );

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

    let targetNum: number;
    let rawToSave: string;

    if (modal.usePreserve) {
      const tail = parseFloat(modal.restOfMonthAmountInput.trim());
      if (!Number.isFinite(tail) || tail < 0) {
        window.alert(
          "Enter a valid dollar amount for the remaining days (zero or more)."
        );
        return;
      }

      /** Same DB sums + bounds as /estimate/publisher — avoids stale frozenSumKnown on the client. */
      const previewRes = await fetch(
        `/api/admin/revenue/estimate/preserve-preview?publisher_id=${encodeURIComponent(
          modal.row.publisher_id
        )}&month=${month}&year=${year}&preserve_first_n_days=${modal.preserveFirstNDays}`,
        { credentials: "include" }
      );
      const previewRaw = await previewRes.text();
      let previewData: {
        ok?: boolean;
        frozenSum?: number;
        tailStartDay?: number;
        tailEndDay?: number;
        rowCount?: number;
        error?: string;
      } = {};
      try {
        previewData = previewRaw ? JSON.parse(previewRaw) : {};
      } catch {
        window.alert("Could not verify locked-in days. Try again.");
        return;
      }
      if (!previewRes.ok || !previewData.ok) {
        window.alert(
          typeof previewData.error === "string"
            ? previewData.error
            : "Could not verify locked-in days. Try again."
        );
        return;
      }
      const tStart = previewData.tailStartDay ?? 0;
      const tEnd = previewData.tailEndDay ?? 0;
      if (tStart > tEnd) {
        window.alert(
          "There are no later days left in this month to fill in. Lower “through which day” so at least one day stays open for new estimates."
        );
        return;
      }
      if ((previewData.rowCount ?? 0) < 1) {
        window.alert(
          "There’s no saved data yet for the days you’re keeping. Generate the full month first."
        );
        return;
      }

      const frozenFresh = Number(previewData.frozenSum ?? 0);
      targetNum = frozenFresh + tail;
      if (!Number.isFinite(targetNum) || targetNum <= 0) {
        window.alert(
          "The full month total must be greater than 0. Check the amount for the remaining days."
        );
        return;
      }
      if (targetNum < frozenFresh - 1e-6) {
        window.alert(
          "The monthly total can’t be less than what’s already on the locked-in days. Increase the amount for the remaining days."
        );
        return;
      }
      rawToSave = targetNum.toFixed(2);
    } else {
      const rawTarget = modal.monthlyTargetInput.trim();
      targetNum = parseFloat(rawTarget);
      if (!Number.isFinite(targetNum) || targetNum <= 0) {
        window.alert("Enter a monthly target greater than 0 (USD) before generating.");
        return;
      }
      rawToSave = rawTarget;
    }

    setEstimateLoading(true);
    setEstimateModal(null);
    try {
      const row = modal.row;
      if (Math.abs(targetNum - Number(row.target_revenue)) > 0.005) {
        await saveTarget(row.publisher_id, rawToSave);
      }
      const res = await fetch("/api/admin/revenue/estimate/publisher", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          publisher_id: row.publisher_id,
          month,
          year,
          ...(modal.usePreserve
            ? { preserve_first_n_days: modal.preserveFirstNDays }
            : { start_day: startDay, end_day: endDay }),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        await loadTargets();
        router.refresh();
      } else {
        window.alert(
          typeof data.error === "string"
            ? data.error
            : "Could not generate estimates. Check the console or try again."
        );
      }
    } finally {
      setEstimateLoading(false);
    }
  }

  const preserveBoundsPreview =
    estimateModal && estimateModal.usePreserve
      ? getFrozenPrefixStatBounds(
          year,
          month,
          estimateModal.row.created_at,
          estimateModal.preserveFirstNDays
        )
      : null;

  const partialFullMonthTotal =
    estimateModal &&
    estimateModal.usePreserve &&
    estimateModal.frozenSumKnown != null
      ? estimateModal.frozenSumKnown +
        (parseFloat(estimateModal.restOfMonthAmountInput) || 0)
      : null;

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
                  <th className="text-left p-3">Estimate</th>
                  <th className="text-left p-3">Estimate status</th>
                </tr>
              </thead>
              <tbody>
                {targets.map((t) => {
                  const activeRange = resolvePublisherStatRange(
                    t.created_at,
                    year,
                    month,
                    null,
                    null
                  );
                  const generateDisabledReason = !activeRange
                    ? "No active days in this month for this publisher."
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

      {estimateModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="estimate-modal-title"
        >
          <div className="w-full max-w-lg rounded-lg bg-white p-6 shadow-xl border border-gray-200 max-h-[90vh] overflow-y-auto">
            <h2
              id="estimate-modal-title"
              className="text-lg font-semibold text-gray-900 mb-1"
            >
              Generate estimates — {estimateModal.row.name}
            </h2>
            <p className="text-sm text-gray-600 mb-4">
              {monthName(month)} {year}
            </p>

            {estimateModal.modalInitLoading ? (
              <p className="text-sm text-gray-600 mb-4">Loading…</p>
            ) : (
            <div className="flex flex-col gap-2 mb-4">
              <button
                type="button"
                disabled={estimateModal.modalInitLoading}
                className={`rounded-lg border px-3 py-2 text-left text-sm ${
                  !estimateModal.usePreserve
                    ? "border-blue-500 bg-blue-50 text-gray-900"
                    : "border-gray-200 bg-white text-gray-800 hover:bg-gray-50"
                }`}
                onClick={() => {
                  const pid = estimateModal.row.publisher_id;
                  let nextMonthly = estimateModal.monthlyTargetInput;
                  if (
                    estimateModal.usePreserve &&
                    estimateModal.frozenSumKnown != null
                  ) {
                    const t =
                      estimateModal.frozenSumKnown +
                      (parseFloat(estimateModal.restOfMonthAmountInput) || 0);
                    if (Number.isFinite(t) && t > 0) {
                      nextMonthly = t.toFixed(2);
                    }
                  }
                  setEstimateModal((m) =>
                    m
                      ? {
                          ...m,
                          usePreserve: false,
                          monthlyTargetInput: nextMonthly,
                        }
                      : m
                  );
                  setEditTargets((prev) => ({ ...prev, [pid]: nextMonthly }));
                }}
              >
                <span className="font-medium">Rebuild the whole month</span>
                <span className="block text-xs text-gray-600 mt-0.5">
                  Replace every day’s estimate using one monthly total below.
                </span>
              </button>
              <button
                type="button"
                disabled={estimateModal.modalInitLoading}
                className={`rounded-lg border px-3 py-2 text-left text-sm ${
                  estimateModal.usePreserve
                    ? "border-blue-500 bg-blue-50 text-gray-900"
                    : "border-gray-200 bg-white text-gray-800 hover:bg-gray-50"
                }`}
                onClick={() => {
                  if (estimateModal.usePreserve) return;
                  void activatePartialFromStats(
                    estimateModal.row,
                    estimateModal.monthlyTargetInput
                  );
                }}
              >
                <span className="font-medium">
                  Only change days the publisher hasn’t seen yet
                </span>
                <span className="block text-xs text-gray-600 mt-0.5">
                  Keeps earlier days as they are; you set the dollar total for the
                  rest of the month.
                </span>
              </button>
            </div>
            )}

            {!estimateModal.modalInitLoading && !estimateModal.usePreserve && (
              <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-3 mb-4">
                <label
                  htmlFor="estimate-modal-monthly-target"
                  className="block text-xs font-medium text-gray-700 mb-1"
                >
                  Monthly total for this month (USD)
                </label>
                <input
                  id="estimate-modal-monthly-target"
                  type="number"
                  min={0}
                  step={0.01}
                  value={estimateModal.monthlyTargetInput}
                  onChange={(e) => {
                    const v = e.target.value;
                    const pid = estimateModal.row.publisher_id;
                    setEstimateModal((m) =>
                      m ? { ...m, monthlyTargetInput: v } : m
                    );
                    setEditTargets((prev) => ({ ...prev, [pid]: v }));
                  }}
                  placeholder="0.00"
                  className="w-full rounded border border-gray-300 px-3 py-2 text-sm bg-white text-gray-900"
                />
              </div>
            )}

            {estimateModal.usePreserve && !estimateModal.modalInitLoading && (
              <div className="space-y-4 mb-4">
                <div className="rounded-lg border border-emerald-200 bg-emerald-50/80 px-3 py-3 text-sm text-emerald-950">
                  <p className="font-medium text-emerald-950 mb-1">
                    We will not change these days
                  </p>
                  {preserveBoundsPreview && preserveBoundsPreview.ok ? (
                    <p>
                      {formatDayRangeLabel(
                        year,
                        month,
                        preserveBoundsPreview.frozenStartDay,
                        preserveBoundsPreview.frozenEndDay
                      )}
                      <span className="text-emerald-800">
                        {" "}
                        (already visible to the publisher)
                      </span>
                    </p>
                  ) : preserveBoundsPreview && !preserveBoundsPreview.ok ? (
                    <p className="text-red-700">{preserveBoundsPreview.error}</p>
                  ) : (
                    <p className="text-gray-600">…</p>
                  )}
                </div>

                <div className="rounded-lg border border-sky-200 bg-sky-50/80 px-3 py-3 text-sm text-sky-950">
                  <p className="font-medium text-sky-950 mb-1">
                    We will generate new estimates for these days only
                  </p>
                  {preserveBoundsPreview && preserveBoundsPreview.ok ? (
                    preserveBoundsPreview.tailStartDay <=
                    preserveBoundsPreview.tailEndDay ? (
                      <p>
                        {formatDayRangeLabel(
                          year,
                          month,
                          preserveBoundsPreview.tailStartDay,
                          preserveBoundsPreview.tailEndDay
                        )}
                      </p>
                    ) : (
                      <p className="text-amber-900">
                        No days left in this month after your cutoff — lower
                        “through day” below.
                      </p>
                    )
                  ) : (
                    <p className="text-gray-600">…</p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Through which calendar day should stay locked in?
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={daysInMonth(year, month)}
                    value={estimateModal.preserveFirstNDays}
                    disabled={estimateModal.previewLoading}
                    onChange={(e) => {
                      const v = parseInt(e.target.value, 10);
                      if (Number.isNaN(v)) return;
                      void refreshPreservePreview(
                        estimateModal.row.publisher_id,
                        v
                      );
                    }}
                    className="w-24 rounded border border-gray-300 px-2 py-1.5 text-sm"
                  />
                  {estimateModal.previewLoading && (
                    <span className="ml-2 text-xs text-gray-500">Updating…</span>
                  )}
                  <p className="mt-2 text-[11px] text-gray-600 leading-snug">
                    If estimates already exist for every day, we pick a starting
                    value so at least one day can be redone. Set this to the{" "}
                    <strong>last day that should stay unchanged</strong> (for
                    example 11 to refresh from day 12 to the end of the month).
                  </p>
                </div>

                <div className="rounded-lg border border-gray-200 bg-white px-3 py-3">
                  <label
                    htmlFor="estimate-rest-amount"
                    className="block text-sm font-medium text-gray-900 mb-1"
                  >
                    How much should the remaining days add up to? (USD)
                  </label>
                  <input
                    id="estimate-rest-amount"
                    type="number"
                    min={0}
                    step={0.01}
                    value={estimateModal.restOfMonthAmountInput}
                    onChange={(e) => {
                      const v = e.target.value;
                      setEstimateModal((m) => (m ? { ...m, restOfMonthAmountInput: v } : m));
                    }}
                    className="w-full rounded border border-gray-300 px-3 py-2 text-sm text-gray-900"
                  />
                  <p className="mt-2 text-xs text-gray-600">
                    This is only for the days in the blue box above. Earlier days
                    stay exactly as they are.
                  </p>
                  {estimateModal.frozenSumKnown != null && (
                    <p className="mt-2 text-xs text-gray-700">
                      Already on locked-in days:{" "}
                      <span className="font-medium tabular-nums">
                        ${estimateModal.frozenSumKnown.toFixed(2)}
                      </span>
                    </p>
                  )}
                  {partialFullMonthTotal != null &&
                    Number.isFinite(partialFullMonthTotal) && (
                      <p className="mt-1 text-xs text-gray-800">
                        Saved monthly total will be:{" "}
                        <span className="font-semibold tabular-nums">
                          ${partialFullMonthTotal.toFixed(2)}
                        </span>{" "}
                        (locked-in + remaining)
                      </p>
                    )}
                </div>
              </div>
            )}

            {!estimateModal.modalInitLoading && !estimateModal.usePreserve && (
            <div className="rounded-md bg-gray-50 border border-gray-100 px-3 py-2 mb-4 text-sm text-gray-800">
              <span className="text-gray-500">Range: </span>
              {formatDayRangeLabel(
                year,
                month,
                estimateModal.startDay,
                estimateModal.endDay
              )}
            </div>
            )}

            {!estimateModal.modalInitLoading && !estimateModal.usePreserve && (
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
            )}

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
                disabled={
                  estimateLoading ||
                  estimateModal.modalInitLoading ||
                  (estimateModal.usePreserve && estimateModal.previewLoading) ||
                  (estimateModal.usePreserve &&
                    !!preserveBoundsPreview &&
                    !preserveBoundsPreview.ok)
                }
                className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                onClick={() => void confirmGenerateFromModal()}
              >
                {estimateLoading
                  ? "Generating…"
                  : estimateModal.modalInitLoading ||
                      (estimateModal.usePreserve && estimateModal.previewLoading)
                    ? "Loading…"
                    : "Generate"}
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
