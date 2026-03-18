import { RevenuePageClient } from "./revenue-page-client";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { CurrencyProvider } from "@/components/currency/currency-provider";
import { CurrencyToggle } from "@/components/currency/currency-toggle";

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
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("preferred_currency")
    .eq("id", user.id)
    .single();

  const initialCurrency =
    profile?.preferred_currency === "BDT" ? "BDT" : "USD";

  return (
    <CurrencyProvider initialCurrency={initialCurrency}>
      <div className="flex items-center justify-end gap-4 mb-4">
        <CurrencyToggle />
      </div>
      <RevenuePageClient
        initialMonth={initialMonth}
        initialYear={initialYear}
      />
    </CurrencyProvider>
  );
}
