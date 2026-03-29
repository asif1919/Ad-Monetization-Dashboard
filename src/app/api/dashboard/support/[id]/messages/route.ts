import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: ticketId } = await params;
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
  if (!publisherId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { data: ticket } = await supabase
    .from("support_tickets")
    .select("id, publisher_id, status")
    .eq("id", ticketId)
    .maybeSingle();

  if (!ticket || ticket.publisher_id !== publisherId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (ticket.status !== "open") {
    return NextResponse.json(
      { error: "This ticket is closed. Open a new ticket if you need more help." },
      { status: 400 }
    );
  }

  const body = await request.json();
  const { message } = body as { message?: string };
  if (!message || !message.trim()) {
    return NextResponse.json({ error: "Message is required" }, { status: 400 });
  }

  const { error } = await supabase.from("support_messages").insert({
    ticket_id: ticketId,
    sender_type: "publisher",
    body: message.trim(),
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
