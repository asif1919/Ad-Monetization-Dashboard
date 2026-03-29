import { createClient } from "@/lib/supabase/server";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  MessageCircle,
  Clock,
  ShieldCheck,
  User,
  Headset,
} from "lucide-react";
import { PublisherReplyForm } from "./publisher-reply-form";

export default async function PublisherSupportDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  
  // --- START LOGIC: DO NOT CHANGE ---
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("publisher_id")
    .eq("id", user.id)
    .single();
  const publisherId = profile?.publisher_id;
  if (!publisherId) redirect("/login");

  const [{ data: ticket }, { data: messages }] = await Promise.all([
    supabase
      .from("support_tickets")
      .select(
        "id, publisher_id, subject, status, created_at, updated_at, publisher_last_seen_at"
      )
      .eq("id", id)
      .maybeSingle(),
    supabase
      .from("support_messages")
      .select("id, sender_type, body, created_at")
      .eq("ticket_id", id)
      .order("created_at", { ascending: true }),
  ]);

  if (!ticket || ticket.publisher_id !== publisherId) notFound();

  await supabase
    .from("support_tickets")
    .update({ publisher_last_seen_at: new Date().toISOString() })
    .eq("id", id);
  // --- END LOGIC ---

  return (
    <div className="max-w-4xl mx-auto py-10 px-4">
      {/* 1. Navigation & Breadcrumb */}
      <Link
        href="/dashboard/support"
        className="inline-flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-indigo-600 transition-colors mb-8 group"
      >
        <ArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-1" />
        Back to my tickets
      </Link>

      {/* 2. Ticket Header Card */}
      <div className="bg-white border border-slate-200 rounded-3xl p-6 md:p-8 shadow-sm mb-10">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                ticket.status === "open" 
                  ? "bg-emerald-50 text-emerald-700 border border-emerald-100" 
                  : "bg-slate-100 text-slate-600 border border-slate-200"
              }`}>
                {ticket.status}
              </span>
              <span className="text-xs text-slate-400 font-medium">
                Ticket ID: {ticket.id.split('-')[0]}
              </span>
            </div>
            <h1 className="text-2xl md:text-3xl font-extrabold text-slate-900 tracking-tight">
              {ticket.subject}
            </h1>
          </div>
          
          <div className="flex items-center gap-4 bg-slate-50 p-4 rounded-2xl border border-slate-100">
            <div className="h-10 w-10 bg-white rounded-xl shadow-sm flex items-center justify-center">
              <ShieldCheck className="w-5 h-5 text-indigo-500" />
            </div>
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Account Security</p>
              <p className="text-sm font-semibold text-slate-700">Verified Publisher</p>
            </div>
          </div>
        </div>

        <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-4 border-t border-slate-100 pt-6">
          <div className="flex items-center gap-2 text-xs text-slate-500 font-medium">
            <Clock className="w-4 h-4" />
            Created {ticket.created_at ? new Date(ticket.created_at).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }) : "—"}
          </div>
          {ticket.updated_at && (
            <div className="flex items-center gap-2 text-xs text-slate-500 font-medium md:justify-end">
              <span className="w-1.5 h-1.5 rounded-full bg-indigo-400" />
              Latest activity {new Date(ticket.updated_at).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}
            </div>
          )}
        </div>
      </div>

      {/* 3. Conversation Flow */}
      <section className="space-y-8">
        <div className="flex items-center gap-3 mb-4">
          <div className="h-px flex-1 bg-slate-200" />
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em]">Message History</span>
          <div className="h-px flex-1 bg-slate-200" />
        </div>

        <div className="space-y-8">
          {messages && messages.length > 0 ? (
            messages.map((m) => {
              const isAdmin = m.sender_type === "admin";
              return (
                <div
                  key={m.id}
                  className={`flex items-start gap-4 ${isAdmin ? "flex-row" : "flex-row-reverse"}`}
                >
                  {/* Avatar Icon */}
                  <div className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 shadow-sm border ${
                    isAdmin 
                      ? "bg-indigo-600 border-indigo-700 text-white" 
                      : "bg-white border-slate-200 text-slate-400"
                  }`}>
                    {isAdmin ? <Headset className="w-5 h-5" /> : <User className="w-5 h-5" />}
                  </div>

                  {/* Bubble */}
                  <div className={`flex flex-col max-w-[80%] ${isAdmin ? "items-start" : "items-end"}`}>
                    <div className="flex items-center gap-3 mb-1.5 px-1">
                      <span className="text-xs font-bold text-slate-900">
                        {isAdmin ? "Official Support" : "You"}
                      </span>
                      <span className="text-[10px] text-slate-400 font-medium">
                        {m.created_at ? new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ""}
                      </span>
                    </div>
                    
                    <div className={`rounded-[2rem] px-6 py-4 shadow-sm text-sm leading-relaxed whitespace-pre-wrap ${
                      isAdmin 
                        ? "bg-white border border-slate-200 text-slate-700 rounded-tl-none" 
                        : "bg-indigo-600 text-white rounded-tr-none"
                    }`}>
                      {m.body}
                    </div>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="text-center py-16 bg-slate-50 rounded-[3rem] border border-dashed border-slate-200">
              <MessageCircle className="w-10 h-10 text-slate-300 mx-auto mb-3" />
              <p className="text-sm text-slate-500 font-medium">Starting a secure conversation...</p>
            </div>
          )}
        </div>
      </section>

      {ticket.status === "open" ? (
        <PublisherReplyForm ticketId={ticket.id} />
      ) : (
        <p className="mt-10 text-sm text-slate-500 border border-dashed border-slate-200 rounded-2xl px-4 py-3 bg-slate-50">
          This ticket is closed. To contact support again, open a new ticket from{" "}
          <Link href="/dashboard/support" className="text-indigo-600 font-medium hover:underline">
            Support
          </Link>
          .
        </p>
      )}

      {/* 4. Support Footer Note */}
      <div className="mt-20 text-center space-y-4">
        <div className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-50 rounded-full text-indigo-700 text-xs font-semibold border border-indigo-100">
          <ShieldCheck className="w-3.5 h-3.5" />
          End-to-end Encrypted Support
        </div>
        <p className="text-xs text-slate-400 max-w-sm mx-auto leading-relaxed">
          Need immediate assistance? Our technical team is notified of every reply on this thread.
        </p>
      </div>
    </div>
  );
}