import { createClient } from "@/lib/supabase/server";
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
  if (!publisherId)
    return NextResponse.json({ error: "No publisher profile" }, { status: 400 });

  const body = await request.json();
  const { subject, message } = body as { subject?: string; message?: string };
  if (!subject || !message)
    return NextResponse.json(
      { error: "Subject and message are required" },
      { status: 400 }
    );

  const { data: ticket, error } = await supabase
    .from("support_tickets")
    .insert({
      publisher_id: publisherId,
      subject,
      message,
    })
    .select("id")
    .single();
  if (error || !ticket)
    return NextResponse.json(
      { error: error?.message ?? "Could not create ticket" },
      { status: 500 }
    );

  const { error: msgError } = await supabase.from("support_messages").insert({
    ticket_id: ticket.id,
    sender_type: "publisher",
    body: message,
  });
  if (msgError)
    return NextResponse.json(
      { error: msgError.message },
      { status: 500 }
    );
  return NextResponse.json({ ok: true });
}

