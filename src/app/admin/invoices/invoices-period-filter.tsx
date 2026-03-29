"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export function InvoicesPeriodFilter({ month, year }: { month: number; year: number }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [yearDraft, setYearDraft] = useState(String(year));

  useEffect(() => {
    setYearDraft(String(year));
  }, [year]);

  function navigate(nextMonth: number, nextYear: number) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("month", String(nextMonth));
    params.set("year", String(nextYear));
    router.push(`/admin/invoices?${params.toString()}`);
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <label className="text-sm text-gray-600">Period</label>
      <select
        value={month}
        onChange={(e) => navigate(Number(e.target.value), year)}
        className="rounded border border-gray-300 px-3 py-2 text-sm bg-white text-gray-900"
        aria-label="Month"
      >
        {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
          <option key={m} value={m}>
            {new Date(2000, m - 1, 1).toLocaleString(undefined, { month: "long" })} ({m})
          </option>
        ))}
      </select>
      <input
        type="number"
        min={2020}
        max={2035}
        value={yearDraft}
        onChange={(e) => setYearDraft(e.target.value)}
        onBlur={() => {
          const y = Number(yearDraft);
          if (Number.isFinite(y) && y >= 2020 && y <= 2035) {
            navigate(month, y);
          } else {
            setYearDraft(String(year));
          }
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") (e.target as HTMLInputElement).blur();
        }}
        className="w-24 rounded border border-gray-300 px-3 py-2 text-sm bg-white text-gray-900"
        aria-label="Year"
      />
    </div>
  );
}
