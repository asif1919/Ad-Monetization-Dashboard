export type DailyEstimateRow = {
  stat_date: string;
  publisher_id: string;
  impressions: number;
  clicks: number;
  revenue: number;
  is_estimated: true;
};

// Simple deterministic PRNG so daily patterns are stable for a given
// (publisher_id, year, month) combination.
function makeRng(seed: string) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = (h * 31 + seed.charCodeAt(i)) | 0;
  }
  let state = h || 1;
  return {
    next() {
      // Linear Congruential Generator (LCG)
      state = (state * 1664525 + 1013904223) >>> 0;
      return state / 0xffffffff;
    },
  };
}

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

  const rng = makeRng(`${publisherId}-${year}-${month}`);

  // Step 1–3: weekday/weekend base, smooth monthly trend, and stronger noise
  const rawWeights: number[] = [];
  for (let day = 1; day <= daysInMonth; day++) {
    const d = new Date(year, month - 1, day);
    const dayOfWeek = d.getDay(); // 0 = Sun, 6 = Sat
    let base: number;
    if (dayOfWeek === 0 || dayOfWeek === 6) {
      base = 0.7 + 0.2 * rng.next(); // weekend
    } else if (dayOfWeek === 5) {
      base = 1.4 + 0.2 * rng.next(); // Friday
    } else {
      base = 1.2 + 0.2 * rng.next(); // Mon–Thu
    }
    const t = day / daysInMonth;
    const trend = 1 + 0.4 * Math.sin(2 * Math.PI * t);
    const noise = 0.5 + 1.3 * rng.next(); // 0.5–1.8
    const w = Math.max(0.01, base * trend * noise);
    rawWeights.push(w);
  }

  // Step 4: explicit spike and slow days
  const indices = Array.from({ length: daysInMonth }, (_, i) => i);
  const pickDistinct = (count: number) => {
    const picked: number[] = [];
    const pool = [...indices];
    while (picked.length < count && pool.length > 0) {
      const idx = Math.floor(rng.next() * pool.length);
      picked.push(pool[idx]);
      pool.splice(idx, 1);
    }
    return picked;
  };

  const spikeCount = Math.min(4, Math.max(2, Math.floor(rng.next() * 4)));
  const slowCount = Math.min(5, Math.max(3, Math.floor(rng.next() * 5)));
  const spikeDays = pickDistinct(spikeCount);
  const remainingForSlow = indices.filter((i) => !spikeDays.includes(i));
  const slowDays: number[] = [];
  while (slowDays.length < slowCount && remainingForSlow.length > 0) {
    const idx = Math.floor(rng.next() * remainingForSlow.length);
    slowDays.push(remainingForSlow[idx]);
    remainingForSlow.splice(idx, 1);
  }

  spikeDays.forEach((i) => {
    const mult = 2 + rng.next(); // 2–3x
    rawWeights[i] *= mult;
  });
  slowDays.forEach((i) => {
    const mult = 0.2 + 0.3 * rng.next(); // 0.2–0.5x
    rawWeights[i] *= mult;
  });

  const weights = rawWeights.map((w) => Math.max(0.05, w));
  const sum = weights.reduce((a, b) => a + b, 0);
  const normalized = weights.map((w) => w / sum);

  // Base eCPM and CTR for this run
  const baseEcpm = 1 + 4 * rng.next(); // 1–5
  const baseCtr = 0.01 + 0.02 * rng.next(); // 1–3%

  const rows: DailyEstimateRow[] = [];
  let accRevenue = 0;
  for (let day = 1; day <= daysInMonth; day++) {
    const statDate = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    let revenue = targetRevenue * normalized[day - 1];
    // Adjust last day to absorb rounding differences so sum matches targetRevenue
    if (day === daysInMonth) {
      revenue = targetRevenue - accRevenue;
    }
    accRevenue += revenue;

    const dayEcpm = baseEcpm * (0.8 + 0.4 * rng.next()); // ±20%
    const dayCtr = baseCtr * (0.7 + 0.6 * rng.next());

    let impressions: number;
    if (dayEcpm > 0) {
      impressions = Math.round((revenue / dayEcpm) * 1000);
    } else {
      impressions = Math.round(revenue * 400);
    }
    const clicks = Math.round(impressions * dayCtr);

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
