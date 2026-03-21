/**
 * Debug logging for revenue file upload / preview. Set env to silence:
 * - Server: REVENUE_UPLOAD_DEBUG=0
 * - Client: NEXT_PUBLIC_REVENUE_UPLOAD_DEBUG=0
 */
function loggingEnabled(): boolean {
  if (typeof process === "undefined") return true;
  const off =
    process.env.REVENUE_UPLOAD_DEBUG === "0" ||
    process.env.NEXT_PUBLIC_REVENUE_UPLOAD_DEBUG === "0";
  return !off;
}

export function logUploadReport(
  scope: string,
  detail: Record<string, unknown>
): void {
  if (!loggingEnabled()) return;
  try {
    console.info(`[upload-report:${scope}]`, detail);
  } catch {
    /* ignore */
  }
}

export function logUploadReportError(scope: string, err: unknown): void {
  if (!loggingEnabled()) return;
  console.error(`[upload-report:${scope}]`, err);
}
