"use client";

import { useCurrency } from "./currency-provider";

export function FormattedMoney({ amountUsd }: { amountUsd: number }) {
  const { formatMoney } = useCurrency();
  return <>{formatMoney(Number.isFinite(amountUsd) ? amountUsd : 0)}</>;
}
