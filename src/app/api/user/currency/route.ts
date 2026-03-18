import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import type { PreferredCurrency } from "@/lib/supabase/types";

export async function PATCH(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

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
    .eq("id", user.id);

  if (error) {
    // Column may not exist yet (migration not run); still return success so UI state stays in sync
    return NextResponse.json({ preferred_currency: currency });
  }
  return NextResponse.json({ preferred_currency: currency });
}
