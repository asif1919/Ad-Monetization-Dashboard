import { redirect } from "next/navigation";

/**
 * Legacy URL: upload now opens from the Revenue table modal.
 * Preserve bookmarks with a redirect to the same month/year + open upload for that publisher.
 */
export default async function RevenueUploadPage({
  searchParams,
}: {
  searchParams: Promise<{ publisher_id?: string; month?: string; year?: string }>;
}) {
  const params = await searchParams;
  const publisherId = params.publisher_id;
  const month = params.month ? Number(params.month) : NaN;
  const year = params.year ? Number(params.year) : NaN;

  if (!publisherId || Number.isNaN(month) || Number.isNaN(year)) {
    redirect("/admin/revenue");
  }

  redirect(
    `/admin/revenue?month=${month}&year=${year}&upload=${encodeURIComponent(publisherId)}`
  );
}

