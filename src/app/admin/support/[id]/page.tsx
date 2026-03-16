import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import { TicketStatusToggle } from "./ticket-status-toggle";
import { TicketReplyForm } from "./ticket-reply-form";

export default async function AdminSupportDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const [{ data: ticket }, { data: messages }] = await Promise.all([
    supabase
      .from("support_tickets")
      .select(
        "id, publisher_id, subject, message, status, created_at, updated_at, admin_last_seen_at"
      )
      .eq("id", id)
      .maybeSingle(),
    supabase
      .from("support_messages")
      .select("id, sender_type, body, created_at")
      .eq("ticket_id", id)
      .order("created_at", { ascending: true }),
  ]);

  if (!ticket) notFound();

  // Mark as seen by admin
  await supabase
    .from("support_tickets")
    .update({ admin_last_seen_at: new Date().toISOString() })
    .eq("id", id);

  return (
    <div>
      <h1 className="text-2xl font-semibold text-gray-900 mb-4">Support ticket</h1>
      <div className="rounded-lg bg-white border border-gray-200 p-4 space-y-4 mb-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-700">
              <span className="font-medium">Subject:</span> {ticket.subject}
            </p>
            <p className="text-sm text-gray-700">
              <span className="font-medium">Publisher ID:</span> {ticket.publisher_id}
            </p>
          </div>
          <TicketStatusToggle id={ticket.id} status={ticket.status} />
        </div>
        <p className="text-xs text-gray-500">
          Created: {ticket.created_at ? new Date(ticket.created_at).toLocaleString() : "—"}
          {ticket.updated_at && (
            <> · Updated: {new Date(ticket.updated_at).toLocaleString()}</>
          )}
        </p>
        <div className="mt-2 border-t border-gray-200 pt-3 space-y-3">
          <p className="text-xs font-medium text-gray-500">Conversation</p>
          <div className="space-y-2">
            {messages && messages.length > 0 ? (
              messages.map((m) => {
                const isAdmin = m.sender_type === "admin";
                return (
                  <div
                    key={m.id}
                    className={`flex ${isAdmin ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={`max-w-md rounded-lg px-3 py-2 ${
                        isAdmin ? "bg-blue-50" : "bg-gray-100"
                      }`}
                    >
                      <p
                        className={`text-xs font-medium mb-1 ${
                          isAdmin ? "text-blue-700" : "text-gray-700"
                        }`}
                      >
                        {isAdmin ? "Admin" : "Publisher"}
                      </p>
                      <p className="text-sm text-gray-900 whitespace-pre-wrap">
                        {m.body}
                      </p>
                      <p className="mt-1 text-[10px] text-gray-500">
                        {m.created_at
                          ? new Date(m.created_at).toLocaleString()
                          : ""}
                      </p>
                    </div>
                  </div>
                );
              })
            ) : (
              <p className="text-xs text-gray-500">No messages yet.</p>
            )}
          </div>
        </div>
        <div className="mt-4 border-t border-gray-200 pt-3">
          <TicketReplyForm id={ticket.id} initialReply={ticket.message ?? ""} />
        </div>
      </div>
    </div>
  );
}

