import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { getUsdToBdtRate } from "@/lib/fx-rate";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const rate = await getUsdToBdtRate();
    return NextResponse.json({ usd_to_bdt: rate });
  } catch (e) {
    console.error("Currency rate fetch error:", e);
    return NextResponse.json(
      { error: "Failed to fetch rate" },
      { status: 500 }
    );
  }
}
