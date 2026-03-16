import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { PublisherSupportIndicator } from "@/components/publisher-support-indicator";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  let { data: profile } = await supabase
    .from("profiles")
    .select("role, publisher_id")
    .eq("id", user.id)
    .single();
  if (profile?.role === "super_admin") redirect("/admin");
  if (!profile?.publisher_id && user.email) {
    const { data: pub } = await supabase
      .from("publishers")
      .select("id")
      .eq("email", user.email)
      .maybeSingle();
    if (pub) {
      await supabase.from("profiles").update({ publisher_id: pub.id }).eq("id", user.id);
      profile = { ...profile, publisher_id: pub.id } as typeof profile;
    }
  }
  if (!profile?.publisher_id) redirect("/login");

  const publisherId = profile.publisher_id;

  // Check if there are any unread admin messages for this publisher
  const { data: ticketsWithMessages } = await supabase
    .from("support_tickets")
    .select(
      "publisher_id, publisher_last_seen_at, support_messages(sender_type, created_at)"
    )
    .eq("publisher_id", publisherId)
    .eq("status", "open")
    .limit(200);

  const hasUnreadSupport =
    (ticketsWithMessages ?? []).some((t: any) => {
      const lastSeen = t.publisher_last_seen_at
        ? new Date(t.publisher_last_seen_at as string)
        : null;
      const messages = (t.support_messages ?? []) as {
        sender_type: string;
        created_at: string | null;
      }[];
      return messages.some((m) => {
        if (m.sender_type !== "admin" || !m.created_at) return false;
        const created = new Date(m.created_at);
        if (!lastSeen) return true;
        return created > lastSeen;
      });
    });

  const nav = [
    { href: "/dashboard", label: "Overview" },
    { href: "/dashboard/reports", label: "Reports" },
    { href: "/dashboard/payments", label: "Payments" },
    { href: "/dashboard/support", label: "Support", support: true },
  ] as const;

  return (
    <div className="min-h-screen flex">
      <aside className="w-56 bg-gray-800 text-white flex flex-col">
        <div className="p-4 font-semibold border-b border-gray-700">
          Publisher Dashboard
        </div>
        <nav className="p-2 flex-1">
          {nav.map(({ href, label, support }) => (
            <Link
              key={href}
              href={href}
              className="block px-3 py-2 rounded hover:bg-gray-700 text-sm"
            >
              <span className="inline-flex items-center">
                {label}
                {support && <PublisherSupportIndicator initialHasNew={hasUnreadSupport} />}
              </span>
            </Link>
          ))}
        </nav>
        <form action="/auth/signout" method="post" className="p-2 border-t border-gray-700">
          <button
            type="submit"
            className="w-full text-left px-3 py-2 rounded hover:bg-gray-700 text-sm"
          >
            Sign out
          </button>
        </form>
      </aside>
      <main className="flex-1 p-6 bg-gray-50 overflow-auto">{children}</main>
    </div>
  );
}
