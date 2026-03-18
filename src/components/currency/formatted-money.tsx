"use client";

import { useContext } from "react";
import { CurrencyContext } from "./currency-provider";

const usdFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 2,
});

export function FormattedMoney({ amountUsd }: { amountUsd: number }) {
  const ctx = useContext(CurrencyContext);
  const safeAmount = Number.isFinite(amountUsd) ? amountUsd : 0;

  if (!ctx) {
    // Fallback: when no CurrencyProvider is present, show plain USD.
    return <>{usdFormatter.format(safeAmount)}</>;
  }

  return <>{ctx.formatMoney(safeAmount)}</>;
}

