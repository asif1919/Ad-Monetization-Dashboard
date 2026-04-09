import { createClient } from "@/lib/supabase/server";
import { runPublisherEstimate } from "@/lib/run-publisher-estimate";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (profile?.role !== "super_admin")
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await request.json();
  const { publisher_id, month, year, start_day, end_day, preserve_first_n_days } =
    body as {
      publisher_id?: string;
      month?: number;
      year?: number;
      start_day?: number | null;
      end_day?: number | null;
      preserve_first_n_days?: number | null;
    };
  if (
    !publisher_id ||
    typeof publisher_id !== "string" ||
    typeof month !== "number" ||
    month < 1 ||
    month > 12 ||
    typeof year !== "number"
  ) {
    return NextResponse.json(
      { error: "publisher_id, month, and year are required" },
      { status: 400 }
    );
  }

  console.log("[api/estimate/publisher] POST", {
    publisher_id: `${publisher_id.slice(0, 8)}…`,
    month,
    year,
    start_day,
    end_day,
    preserve_first_n_days,
  });

  const result = await runPublisherEstimate(supabase, {
    publisher_id,
    month,
    year,
    start_day,
    end_day,
    preserve_first_n_days,
  });

  if (!result.ok) {
    return NextResponse.json(
      { error: result.error, code: result.code },
      { status: result.status }
    );
  }

  if (result.skipped && result.reason === "no_target") {
    return NextResponse.json({
      skipped: true,
      reason: "no_target",
    });
  }

  if (result.skipped && result.reason === "publisher_not_active_this_month") {
    return NextResponse.json({
      skipped: true,
      reason: "publisher_not_active_this_month",
      inserted_count: 0,
    });
  }

  return NextResponse.json({
    skipped: false,
    inserted_count: result.inserted_count,
    mode: result.mode,
    frozen_sum: result.frozen_sum,
    remaining: result.remaining,
    tail_start_day: result.tail_start_day,
    tail_end_day: result.tail_end_day,
  });
}
