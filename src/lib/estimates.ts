export type DailyEstimateRow = {
  stat_date: string;
  publisher_id: string;
  impressions: number;
  clicks: number;
  revenue: number;
  is_estimated: true;
};

/**
 * Generate estimated daily stats for one publisher for a month, with varying
 * daily revenue (weekday/weekend pattern + noise) that sums to target_revenue.
 */
export function distributePublisherTargetRevenue(
  publisherId: string,
  targetRevenue: number,
  year: number,
  month: number
): DailyEstimateRow[] {
  const daysInMonth = new Date(year, month, 0).getDate();
  if (daysInMonth === 0 || targetRevenue <= 0) return [];

  const weights: number[] = [];
  for (let day = 1; day <= daysInMonth; day++) {
    const d = new Date(year, month - 1, day);
    const dayOfWeek = d.getDay();
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
    let w = isWeekend ? 0.8 : 1.2;
    w += 0.3 * (Math.sin((day / daysInMonth) * Math.PI * 2) + 1);
    w += 0.15 * (Math.random() - 0.5);
    weights.push(Math.max(0.01, w));
  }
  const sum = weights.reduce((a, b) => a + b, 0);
  const normalized = weights.map((w) => w / sum);

  const baseEcpm = 1 + Math.random() * 4;
  const ctr = 0.01 + Math.random() * 0.02;

  const rows: DailyEstimateRow[] = [];
  for (let day = 1; day <= daysInMonth; day++) {
    const statDate = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    const revenue = targetRevenue * normalized[day - 1];
    const impressions = Math.round((revenue / (baseEcpm / 1000)) || 0);
    const clicks = Math.round(impressions * ctr);
    rows.push({
      stat_date: statDate,
      publisher_id: publisherId,
      impressions,
      clicks,
      revenue,
      is_estimated: true,
    });
  }
  return rows;
}

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
