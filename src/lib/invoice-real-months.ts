/** YYYY-MM for a calendar month (matches stat_date prefix). */
export function monthKey(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, "0")}`;
}

/** Map publisher_id → set of "YYYY-MM" months that have at least one real daily stat row. */
export function buildPublisherMonthsWithRealStats(
  rows: { publisher_id: string; stat_date: string }[]
): Map<string, Set<string>> {
  const map = new Map<string, Set<string>>();
  for (const r of rows) {
    const pid = String(r.publisher_id);
    const sd = String(r.stat_date).slice(0, 10);
    if (sd.length < 7) continue;
    const ym = sd.slice(0, 7);
    if (!map.has(pid)) map.set(pid, new Set());
    map.get(pid)!.add(ym);
  }
  return map;
}

export function invoiceMatchesRealStatsMonth(
  inv: { publisher_id: string; year: number | string; month: number | string },
  realMonthsByPublisher: Map<string, Set<string>>
): boolean {
  const y = Number(inv.year);
  const m = Number(inv.month);
  if (!Number.isFinite(y) || !Number.isFinite(m)) return false;
  const months = realMonthsByPublisher.get(String(inv.publisher_id));
  if (!months) return false;
  return months.has(monthKey(y, m));
}
