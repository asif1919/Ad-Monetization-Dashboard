export type SupportedCurrency = "USD" | "BDT";

export const BASE_CURRENCY: SupportedCurrency = "USD";

/**
 * All monetary values stored in the database (e.g. daily_stats.revenue,
 * publisher_monthly_targets.target_revenue, payouts) MUST be in USD.
 * Any conversion to other currencies is done only for display in the UI.
 */

const usdFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 2,
});

const bdtFormatter = new Intl.NumberFormat("en-BD", {
  style: "currency",
  currency: "BDT",
  maximumFractionDigits: 2,
});

export function formatMoneyFromUsd(
  amountUsd: number,
  currency: SupportedCurrency,
  usdToBdtRate?: number
): string {
  if (!Number.isFinite(amountUsd)) {
    amountUsd = 0;
  }

  if (currency === "USD") {
    return usdFormatter.format(amountUsd);
  }

  const rate = typeof usdToBdtRate === "number" && usdToBdtRate > 0 ? usdToBdtRate : 0;
  const amountBdt = amountUsd * rate;
  return bdtFormatter.format(amountBdt);
}

export function convertUsdToBdt(amountUsd: number, usdToBdtRate: number): number {
  if (!Number.isFinite(amountUsd) || !Number.isFinite(usdToBdtRate) || usdToBdtRate <= 0) {
    return 0;
  }
  return amountUsd * usdToBdtRate;
}

export function convertAmount(
  amountUsd: number,
  currency: SupportedCurrency,
  usdToBdtRate: number
): number {
  if (currency === "USD") {
    return Number.isFinite(amountUsd) ? amountUsd : 0;
  }
  return convertUsdToBdt(amountUsd, usdToBdtRate);
}

