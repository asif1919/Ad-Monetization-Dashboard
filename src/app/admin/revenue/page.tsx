import { createClient } from "@/lib/supabase/server";
import { RevenuePageClient } from "./revenue-page-client";

export default async function RevenuePage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string; year?: string }>;
}) {
  const params = await searchParams;
  const now = new Date();
  const initialMonth = params.month
    ? Math.min(12, Math.max(1, parseInt(params.month, 10) || now.getMonth() + 1))
    : now.getMonth() + 1;
  const initialYear = params.year
    ? parseInt(params.year, 10) || now.getFullYear()
    : now.getFullYear();

  const supabase = await createClient();
  const { data: configs } = await supabase
    .from("monthly_config")
    .select("month, year, real_data_imported_at")
    .order("year", { ascending: false })
    .order("month", { ascending: false })
    .limit(24);

  return (
    <RevenuePageClient
      initialMonth={initialMonth}
      initialYear={initialYear}
      configs={configs ?? []}
    />
  );
}
