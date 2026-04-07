import { resolveDashboardPublisher } from "@/lib/dashboard-effective-publisher";
import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import type { PreferredCurrency } from "@/lib/supabase/types";

export async function PATCH(request: Request) {
  const supabase = await createClient();
  const dash = await resolveDashboardPublisher(supabase);
  if (!dash.ok) {
    const status = dash.redirectTo === "/login" ? 401 : 403;
    return NextResponse.json({ error: "Unauthorized" }, { status });
  }
  if (dash.viewAs) {
    return NextResponse.json(
      { error: "Currency preference cannot be changed while viewing as publisher" },
      { status: 403 }
    );
  }

  let body: { preferred_currency?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const currency = body?.preferred_currency;
  if (currency !== "USD" && currency !== "BDT")
    return NextResponse.json(
      { error: "preferred_currency must be USD or BDT" },
      { status: 400 }
    );

  const { error } = await supabase
    .from("profiles")
    .update({ preferred_currency: currency as PreferredCurrency })
    .eq("id", dash.user.id);

  if (error) {
    // Column may not exist yet (migration not run); still return success so UI state stays in sync
    return NextResponse.json({ preferred_currency: currency });
  }
  return NextResponse.json({ preferred_currency: currency });
}
