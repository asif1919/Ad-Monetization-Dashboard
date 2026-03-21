/**
 * Whether a daily_stats row represents imported / real data (not target-based estimates).
 * Handles strict booleans and occasional string/serialization quirks from PostgREST.
 */
export function isRealDailyStatRow(row: { is_estimated?: unknown }): boolean {
  const v = row.is_estimated;
  if (v === false) return true;
  if (v === true) return false;
  if (typeof v === "string") {
    const s = v.trim().toLowerCase();
    return s === "false" || s === "f" || s === "0" || s === "no";
  }
  return false;
}
