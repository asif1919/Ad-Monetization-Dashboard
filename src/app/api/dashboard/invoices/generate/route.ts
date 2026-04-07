import { createClient } from "@/lib/supabase/server";
import { generateInvoiceForPublisherMonth } from "@/lib/generate-invoice-for-publisher";
import { isCurrentOrPreviousCalendarMonthUtc } from "@/lib/invoice-month-window";
import { requireDashboardPublisherForApi } from "@/lib/dashboard-effective-publisher";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const supabase = await createClient();
  const scope = await requireDashboardPublisherForApi(supabase);
  if ("response" in scope) return scope.response;
  const { publisherId } = scope;

  const body = await request.json().catch(() => ({}));
  const { month, year } = body as { month?: number; year?: number };
  if (typeof month !== "number" || month < 1 || month > 12 || typeof year !== "number") {
    return NextResponse.json({ error: "Invalid month or year" }, { status: 400 });
  }

  if (!isCurrentOrPreviousCalendarMonthUtc(year, month)) {
    return NextResponse.json(
      {
        error:
          "You can only create an invoice for the current month or the previous calendar month.",
      },
      { status: 400 }
    );
  }

  const result = await generateInvoiceForPublisherMonth(supabase, publisherId, month, year);
  if (!result.ok) {
    return NextResponse.json({ error: result.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
