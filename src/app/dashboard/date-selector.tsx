"use client";

import { useRouter, useSearchParams } from "next/navigation";

export function OverviewDateSelector() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const current =
    searchParams.get("date") ?? new Date().toISOString().slice(0, 10);

  const updateDate = (dateStr: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (dateStr) params.set("date", dateStr);
    else params.delete("date");
    const query = params.toString();
    router.push(query ? `/dashboard?${query}` : "/dashboard");
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    updateDate(e.target.value);
  };

  return (
    <div className="flex items-center gap-2 mb-4">
      <input
        type="date"
        value={current}
        onChange={handleChange}
        className="rounded border border-gray-300 px-3 py-1 text-sm bg-white text-gray-900"
      />
    </div>
  );
}

