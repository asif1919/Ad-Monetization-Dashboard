/**
 * Distribute expected monthly revenue across days of the month per publisher.
 * Each publisher gets (expected_revenue * revenue_share_pct / 100) for the month,
 * distributed equally across days.
 */
export function distributeMonthlyRevenue(
  expectedRevenue: number,
  year: number,
  month: number,
  revenueShareByPublisher: Array<{ publisher_id: string; revenue_share_pct: number }>
): {
  stat_date: string;
  publisher_id: string;
  revenue: number;
  impressions: number;
}[] {
  const daysInMonth = new Date(year, month, 0).getDate();
  const rows: {
    stat_date: string;
    publisher_id: string;
    revenue: number;
    impressions: number;
  }[] = [];

  for (let day = 1; day <= daysInMonth; day++) {
    const statDate = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    for (const { publisher_id, revenue_share_pct } of revenueShareByPublisher) {
      const publisherMonthTotal =
        (expectedRevenue * revenue_share_pct) / 100;
      const revenue = publisherMonthTotal / daysInMonth;
      // Placeholder impressions (e.g. proportional to revenue for eCPM display)
      const impressions = Math.round(revenue * 400); // arbitrary scale
      rows.push({
        stat_date: statDate,
        publisher_id,
        revenue,
        impressions,
      });
    }
  }
  return rows;
}
