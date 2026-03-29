import { createClient } from "@/lib/supabase/server";
import { generateInvoiceForPublisherMonth } from "@/lib/generate-invoice-for-publisher";
import { isCurrentOrPreviousCalendarMonthUtc } from "@/lib/invoice-month-window";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles")
    .select("publisher_id")
    .eq("id", user.id)
    .single();
  const publisherId = profile?.publisher_id;
  if (!publisherId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

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
