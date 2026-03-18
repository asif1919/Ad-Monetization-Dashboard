/**
 * Fetches and caches USD → BDT exchange rate for display only.
 * All stored amounts remain in USD; this is used only for UI conversion.
 */

const CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours

let cache: { rate: number; fetchedAt: number } | null = null;

function getFallbackRate(): number {
  const fallback = process.env.FX_USD_BDT_FALLBACK;
  if (fallback != null && fallback !== "") {
    const n = parseFloat(fallback);
    if (Number.isFinite(n) && n > 0) return n;
  }
  return 110; // default fallback if env not set
}

/**
 * Fetches current USD → BDT rate from the configured API.
 * Uses FX_API_URL if set (expected to return JSON with rate info), otherwise
 * uses Frankfurter (no key). Returns fallback on any error.
 */
export async function fetchUsdToBdtRate(): Promise<number> {
  const url =
    process.env.FX_API_URL ||
    "https://api.frankfurter.dev/v1/latest?base=USD&symbols=BDT";

  try {
    const res = await fetch(url, { next: { revalidate: 0 } });
    if (!res.ok) return getFallbackRate();
    const data = (await res.json()) as Record<string, unknown>;

    // Frankfurter: { rates: { BDT: 110.5 } }
    const rates = data?.rates as Record<string, number> | undefined;
    if (rates && typeof rates.BDT === "number" && rates.BDT > 0)
      return rates.BDT;

    // Alternative shape: e.g. { conversion_rate: 110.5 }
    const cr = (data as { conversion_rate?: number }).conversion_rate;
    if (typeof cr === "number" && cr > 0) return cr;

    return getFallbackRate();
  } catch {
    return getFallbackRate();
  }
}

/**
 * Returns cached USD → BDT rate, refreshing from API if cache is stale or missing.
 * Uses FX_USD_BDT_FALLBACK (or 110) when API fails and no valid cache exists.
 */
export async function getUsdToBdtRate(): Promise<number> {
  const now = Date.now();
  if (cache && now - cache.fetchedAt < CACHE_TTL_MS) return cache.rate;

  const rate = await fetchUsdToBdtRate();
  cache = { rate, fetchedAt: now };
  return rate;
}
