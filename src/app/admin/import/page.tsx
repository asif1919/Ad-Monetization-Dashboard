import { createClient } from "@/lib/supabase/server";
import { ImportWizard } from "./import-wizard";

export default async function ImportPage() {
  const supabase = await createClient();
  const { data: configs } = await supabase
    .from("monthly_config")
    .select("month, year, real_data_imported_at")
    .order("year", { ascending: false })
    .order("month", { ascending: false })
    .limit(24);

  return (
    <div>
      <h1 className="text-2xl font-semibold text-gray-900 mb-6">
        Import month-end report (Excel)
      </h1>
      <p className="text-gray-600 mb-6">
        Upload an Excel sheet with publisher details and performance (date, domain/site ID, impressions, clicks, revenue).
        Map columns below, then preview and import. Real data will replace estimated data for the selected month.
      </p>
      <ImportWizard configs={configs ?? []} />
    </div>
  );
}
