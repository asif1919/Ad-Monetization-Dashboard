/**
 * Logs when any of:
 * - NEXT_PUBLIC_AUTH_DEBUG=1 in .env.local
 * - NODE_ENV=development (npm run dev), so you see [auth-debug:...] without extra setup
 *
 * Set NEXT_PUBLIC_AUTH_DEBUG=0 to silence in development once issues are fixed.
 */
export function isAuthDebugEnabled(): boolean {
  if (process.env.NEXT_PUBLIC_AUTH_DEBUG === "0") return false;
  if (process.env.NEXT_PUBLIC_AUTH_DEBUG === "1") return true;
  return process.env.NODE_ENV === "development";
}

export function authDebug(
  scope: string,
  payload?: Record<string, unknown>
): void {
  if (!isAuthDebugEnabled()) return;
  if (payload && Object.keys(payload).length > 0) {
    console.info(`[auth-debug:${scope}]`, payload);
  } else {
    console.info(`[auth-debug:${scope}]`);
  }
}
