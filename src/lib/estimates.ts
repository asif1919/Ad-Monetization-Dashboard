export type DailyEstimateRow = {
  stat_date: string;
  publisher_id: string;
  impressions: number;
  clicks: number;
  revenue: number;
  is_estimated: true;
};

/**
 * First calendar day (1–31) in `year`/`month` that should have stats for this publisher,
 * based on `publishers.created_at` (UTC date). Days before this in the month have no rows.
 * Returns `daysInMonth + 1` if the publisher did not exist yet during that month.
 */
export function getFirstActiveStatDayInMonth(
  publisherCreatedAt: string | null | undefined,
  year: number,
  month: number
): number {
  const daysInMonth = new Date(year, month, 0).getDate();
  if (!publisherCreatedAt) return 1;

  const created = new Date(publisherCreatedAt);
  if (Number.isNaN(created.getTime())) return 1;

  const cy = created.getUTCFullYear();
  const cm = created.getUTCMonth() + 1;
  const cd = created.getUTCDate();

  if (year < cy || (year === cy && month < cm)) {
    return daysInMonth + 1;
  }
  if (year > cy || month > cm) {
    return 1;
  }
  return Math.min(cd, daysInMonth);
}

/**
 * Resolve inclusive day-of-month range for estimates.
 * Admin overrides are clamped to the month; the range cannot start before the publisher existed.
 * Returns null if there is no valid range.
 */
export function resolvePublisherStatRange(
  publisherCreatedAt: string | null | undefined,
  year: number,
  month: number,
  adminStartDay?: number | null,
  adminEndDay?: number | null
): { first: number; last: number } | null {
  const daysInMonth = new Date(year, month, 0).getDate();
  const earliest = getFirstActiveStatDayInMonth(
    publisherCreatedAt,
    year,
    month
  );
  if (earliest > daysInMonth) return null;

  let first = earliest;
  let last = daysInMonth;

  if (adminStartDay != null && Number.isFinite(adminStartDay)) {
    const a = Math.max(1, Math.min(daysInMonth, Math.floor(Number(adminStartDay))));
    first = Math.max(earliest, a);
  }
  if (adminEndDay != null && Number.isFinite(adminEndDay)) {
    const b = Math.max(1, Math.min(daysInMonth, Math.floor(Number(adminEndDay))));
    last = b;
  }

  if (first > last) return null;
  return { first, last };
}

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

export type DistributePublisherOptions = {
  /** First day of month (1–31) to include; default 1. Earlier days get no rows. */
  firstActiveDay?: number;
  /** Last day of month (1–31) to include; default last day of month. */
  lastActiveDay?: number;
};

/**
 * Generate estimated daily stats for one publisher for a month, with varying
 * daily revenue (weekday/weekend pattern + noise) that sums to target_revenue.
 * Only days from `firstActiveDay` through `lastActiveDay` (inclusive) are generated; the full
 * target is spread across those active days only.
 */
export function distributePublisherTargetRevenue(
  publisherId: string,
  targetRevenue: number,
  year: number,
  month: number,
  options?: DistributePublisherOptions
): DailyEstimateRow[] {
  const daysInMonth = new Date(year, month, 0).getDate();
  const firstActiveDay = Math.max(1, options?.firstActiveDay ?? 1);
  if (daysInMonth === 0 || targetRevenue <= 0) return [];
  if (firstActiveDay > daysInMonth) return [];

  const lastActiveDay = Math.min(
    daysInMonth,
    Math.max(firstActiveDay, options?.lastActiveDay ?? daysInMonth)
  );
  const activeCount = lastActiveDay - firstActiveDay + 1;
  if (activeCount <= 0) return [];

  const rng = makeRng(
    `${publisherId}-${year}-${month}-${firstActiveDay}-${lastActiveDay}`
  );

  // Step 1–3: weekday/weekend base, smooth monthly trend, and stronger noise
  const rawWeights: number[] = [];
  for (let day = firstActiveDay; day <= lastActiveDay; day++) {
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
    const t = (day - firstActiveDay + 1) / activeCount;
    const trend = 1 + 0.4 * Math.sin(2 * Math.PI * t);
    const noise = 0.5 + 1.3 * rng.next(); // 0.5–1.8
    const w = Math.max(0.01, base * trend * noise);
    rawWeights.push(w);
  }

  // Step 4: explicit spike and slow days
  const indices = Array.from({ length: activeCount }, (_, i) => i);
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
  for (let i = 0; i < activeCount; i++) {
    const day = firstActiveDay + i;
    const statDate = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    let revenue = targetRevenue * normalized[i];
    // Adjust last active day to absorb rounding differences so sum matches targetRevenue
    if (i === activeCount - 1) {
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
 * spread only across days from `firstActiveDay` (default 1) through month-end.
 */
export function distributeMonthlyRevenue(
  expectedRevenue: number,
  year: number,
  month: number,
  revenueShareByPublisher: Array<{
    publisher_id: string;
    revenue_share_pct: number;
    /** First day of month (1–31) with stats; omit or 1 = whole month */
    firstActiveDay?: number;
  }>
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
    for (const { publisher_id, revenue_share_pct, firstActiveDay = 1 } of revenueShareByPublisher) {
      const start = Math.max(1, firstActiveDay);
      if (day < start) continue;
      const activeDays = daysInMonth - start + 1;
      if (activeDays <= 0) continue;

      const publisherMonthTotal =
        (expectedRevenue * revenue_share_pct) / 100;
      const revenue = publisherMonthTotal / activeDays;
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
