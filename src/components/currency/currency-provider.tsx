"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import {
  formatMoneyFromUsd,
  convertUsdToBdt,
  type SupportedCurrency,
} from "@/lib/currency";

type CurrencyContextValue = {
  currency: SupportedCurrency;
  setCurrency: (c: SupportedCurrency) => void;
  formatMoney: (amountUsd: number) => string;
  convert: (amountUsd: number) => number;
  usdToBdtRate: number | null;
  rateLoading: boolean;
  rateError: boolean;
  savingCurrency: boolean;
  refreshRate: () => Promise<void>;
};

const CurrencyContext = createContext<CurrencyContextValue | null>(null);

export function CurrencyProvider({
  initialCurrency,
  children,
}: {
  initialCurrency: SupportedCurrency;
  children: React.ReactNode;
}) {
  const [currency, setCurrencyState] = useState<SupportedCurrency>(initialCurrency);
  const [usdToBdtRate, setUsdToBdtRate] = useState<number | null>(null);
  const [rateLoading, setRateLoading] = useState(false);
  const [rateError, setRateError] = useState(false);
  const [savingCurrency, setSavingCurrency] = useState(false);

  const fetchRate = useCallback(async () => {
    setRateLoading(true);
    setRateError(false);
    try {
      const res = await fetch("/api/currency/rate");
      const data = await res.json();
      if (res.ok && typeof data.usd_to_bdt === "number" && data.usd_to_bdt > 0) {
        setUsdToBdtRate(data.usd_to_bdt);
      } else {
        setRateError(true);
      }
    } catch {
      setRateError(true);
    } finally {
      setRateLoading(false);
    }
  }, []);

  useEffect(() => {
    setCurrencyState(initialCurrency);
  }, [initialCurrency]);

  useEffect(() => {
    if (currency === "BDT") fetchRate();
  }, [currency, fetchRate]);

  const setCurrency = useCallback((c: SupportedCurrency) => {
    setCurrencyState(c);
    setSavingCurrency(true);
    fetch("/api/user/currency", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ preferred_currency: c }),
    })
      .catch(() => {})
      .finally(() => setSavingCurrency(false));
  }, []);

  const formatMoney = useCallback(
    (amountUsd: number) =>
      formatMoneyFromUsd(amountUsd, currency, usdToBdtRate ?? undefined),
    [currency, usdToBdtRate]
  );

  const convert = useCallback(
    (amountUsd: number) =>
      currency === "USD" ? amountUsd : convertUsdToBdt(amountUsd, usdToBdtRate ?? 0),
    [currency, usdToBdtRate]
  );

  const refreshRate = useCallback(() => fetchRate(), [fetchRate]);

  const value: CurrencyContextValue = {
    currency,
    setCurrency,
    formatMoney,
    convert,
    usdToBdtRate,
    rateLoading,
    rateError,
    savingCurrency,
    refreshRate,
  };

  return (
    <CurrencyContext.Provider value={value}>{children}</CurrencyContext.Provider>
  );
}

export function useCurrency(): CurrencyContextValue {
  const ctx = useContext(CurrencyContext);
  if (!ctx) throw new Error("useCurrency must be used within CurrencyProvider");
  return ctx;
}
