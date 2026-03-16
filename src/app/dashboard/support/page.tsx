import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { SupportForm } from "./support-form";
import Link from "next/link";

export default async function PublisherSupportPage() {
  const supabase = await createClient();
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

  const { data } = await supabase
    .from("support_tickets")
    .select(
      "id, subject, status, created_at, publisher_last_seen_at, support_messages(sender_type, created_at)"
    )
    .eq("publisher_id", publisherId)
    .order("created_at", { ascending: false })
    .limit(50);
  const tickets =
    (data ?? []).map((t: any) => {
      const messages = (t.support_messages ?? []) as {
        sender_type: string;
        created_at: string | null;
      }[];
      const lastSeen = t.publisher_last_seen_at
        ? new Date(t.publisher_last_seen_at as string)
        : null;
      const hasNewAdminReply =
        messages.some((m) => {
          if (m.sender_type !== "admin" || !m.created_at) return false;
          const created = new Date(m.created_at);
          if (!lastSeen) return true;
          return created > lastSeen;
        }) && t.status === "open";
      return {
        raw: t,
        view: {
          id: t.id as string,
          subject: t.subject as string,
          status: t.status as "open" | "closed",
          created_at: t.created_at as string | null,
          has_new_admin_reply: hasNewAdminReply,
        },
      };
    }) ?? [];

  const anyWithNewReply = tickets.some((t) => t.view.has_new_admin_reply);

  if (anyWithNewReply) {
    await supabase
      .from("support_tickets")
      .update({ publisher_last_seen_at: new Date().toISOString() })
      .eq("publisher_id", publisherId)
      .eq("status", "open");
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold text-gray-900 mb-6">Support</h1>
      <SupportForm />
      <div className="mt-8 rounded-lg bg-white border border-gray-200 overflow-hidden">
        <h2 className="px-4 py-3 font-medium border-b border-gray-200">
          Your recent tickets
        </h2>
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="text-left p-3">Subject</th>
              <th className="text-left p-3">Status</th>
              <th className="text-left p-3">Created</th>
              <th className="text-left p-3"></th>
            </tr>
          </thead>
          <tbody>
            {tickets.map(({ view: t }) => (
              <tr key={t.id} className="border-b border-gray-100">
                <td className="p-3">
                  <span className={t.has_new_admin_reply ? "font-semibold" : ""}>
                    {t.subject}
                  </span>
                  {t.has_new_admin_reply && (
                    <span className="ml-2 inline-flex items-center rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-medium text-blue-700">
                      New reply
                    </span>
                  )}
                </td>
                <td className="p-3">
                  <span
                    className={
                      t.status === "open" ? "text-amber-600 font-medium" : "text-gray-600"
                    }
                  >
                    {t.status}
                  </span>
                </td>
                <td className="p-3 text-gray-600">
                  {t.created_at ? new Date(t.created_at).toLocaleString() : "—"}
                </td>
                <td className="p-3 text-right">
                  <Link
                    href={`/dashboard/support/${t.id}`}
                    className="text-xs text-blue-600 hover:underline"
                  >
                    View conversation
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {tickets.length === 0 && (
          <p className="p-4 text-gray-600">
            You haven&apos;t created any support tickets yet.
          </p>
        )}
      </div>
    </div>
  );
}

