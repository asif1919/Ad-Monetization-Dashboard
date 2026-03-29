/** Current and previous calendar month in UTC (same window as invoice generation). */
export function currentAndPreviousCalendarMonthUtc(now = new Date()): { year: number; month: number }[] {
  const cy = now.getUTCFullYear();
  const cm = now.getUTCMonth() + 1;
  let pm = cm - 1;
  let py = cy;
  if (pm < 1) {
    pm = 12;
    py -= 1;
  }
  return [
    { year: cy, month: cm },
    { year: py, month: pm },
  ];
}

/** Whether (year, month) is the current UTC calendar month or the immediately previous UTC month. */
export function isCurrentOrPreviousCalendarMonthUtc(year: number, month: number, now = new Date()): boolean {
  return currentAndPreviousCalendarMonthUtc(now).some((p) => p.year === year && p.month === month);
}
