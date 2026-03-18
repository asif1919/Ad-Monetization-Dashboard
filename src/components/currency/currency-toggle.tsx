"use client";

import { useCurrency } from "./currency-provider";

export function CurrencyToggle() {
  const { currency, setCurrency, rateLoading, rateError, savingCurrency } =
    useCurrency();
  const isLoading = savingCurrency || (currency === "BDT" && rateLoading);

  return (
    <div className="flex items-center gap-2">
      <div className="flex items-center gap-1 rounded border border-gray-300 bg-white p-0.5 text-sm">
        <button
          type="button"
          onClick={() => setCurrency("USD")}
          disabled={savingCurrency}
          className={`rounded px-2 py-1 font-medium ${
            currency === "USD"
              ? "bg-gray-200 text-gray-900"
              : "text-gray-600 hover:bg-gray-100"
          } disabled:opacity-60`}
        >
          USD
        </button>
        <button
          type="button"
          onClick={() => setCurrency("BDT")}
          disabled={isLoading}
          className={`rounded px-2 py-1 font-medium ${
            currency === "BDT"
              ? "bg-gray-200 text-gray-900"
              : "text-gray-600 hover:bg-gray-100"
          } disabled:opacity-60`}
        >
          {currency === "BDT" && rateLoading ? "BDT…" : "BDT"}
        </button>
      </div>
      {isLoading && (
        <span className="text-xs text-gray-500" aria-live="polite">
          Loading…
        </span>
      )}
      {rateError && currency === "BDT" && !rateLoading && (
        <span className="text-xs text-amber-600" title="Using fallback rate">
          (rate unavailable)
        </span>
      )}
    </div>
  );
}
