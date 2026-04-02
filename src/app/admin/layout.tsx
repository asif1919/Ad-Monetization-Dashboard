import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { AdminSupportIndicator } from "@/components/admin-support-indicator";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (profile?.role !== "super_admin") redirect("/dashboard");

  // Determine if there are any unread publisher messages for admin
  const { data: ticketsWithMessages } = await supabase
    .from("support_tickets")
    .select("admin_last_seen_at, support_messages(sender_type, created_at)")
    .eq("status", "open")
    .limit(200);

  const hasUnreadSupport =
    (ticketsWithMessages ?? []).some((t: any) => {
      const lastSeen = t.admin_last_seen_at
        ? new Date(t.admin_last_seen_at as string)
        : null;
      const messages = (t.support_messages ?? []) as {
        sender_type: string;
        created_at: string | null;
      }[];
      return messages.some((m) => {
        if (m.sender_type !== "publisher" || !m.created_at) return false;
        const created = new Date(m.created_at);
        if (!lastSeen) return true;
        return created > lastSeen;
      });
    });

  const nav = [
    { href: "/admin", label: "Overview" },
    { href: "/admin/publishers", label: "Publishers" },
    { href: "/admin/revenue", label: "Revenue & Payouts" },
    { href: "/admin/invoices", label: "Invoices" },
    { href: "/admin/support", label: "Support", support: true },
  ] as const;

  return (
    <div className="min-h-screen flex">
      <aside className="w-64 flex flex-col bg-slate-950 text-slate-100 border-r border-slate-800/90 shadow-[inset_-1px_0_0_rgba(99,102,241,0.12)]">
        <div className="px-4 py-5 border-b border-indigo-500/25 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-indigo-400">
            Console
          </p>
          <p className="text-xl font-bold text-white mt-1.5 tracking-tight">Admin</p>
        </div>
        <nav className="p-3 flex-1 space-y-1">
          {nav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="block px-3 py-3 rounded-lg text-base font-medium text-slate-300 hover:bg-indigo-950/70 hover:text-white transition-colors"
            >
              <span className="inline-flex items-center gap-1">
                {item.label}
                {"support" in item && item.support && (
                  <AdminSupportIndicator initialHasNew={hasUnreadSupport} />
                )}
              </span>
            </Link>
          ))}
        </nav>
        <div className="p-3 border-t border-slate-800/90">
          <form action="/auth/signout" method="post">
            <button
              type="submit"
              className="w-full text-left px-3 py-3 rounded-lg text-base font-medium text-slate-400 hover:bg-slate-900 hover:text-slate-100 transition-colors"
            >
              Sign out
            </button>
          </form>
        </div>
      </aside>
      <main className="flex-1 p-6 bg-slate-50 overflow-auto">{children}</main>
    </div>
  );
}
