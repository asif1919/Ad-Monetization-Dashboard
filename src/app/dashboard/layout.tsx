import { createClient } from "@/lib/supabase/server";
import { resolveDashboardPublisher } from "@/lib/dashboard-effective-publisher";
import { redirect } from "next/navigation";
import Link from "next/link";
import { PublisherSupportIndicator } from "@/components/publisher-support-indicator";
import { CurrencyProvider } from "@/components/currency/currency-provider";
import { CurrencyToggle } from "@/components/currency/currency-toggle";
import { ViewAsPublisherBanner } from "@/components/view-as-publisher-banner";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const resolved = await resolveDashboardPublisher(supabase);
  if (!resolved.ok) {
    redirect(resolved.redirectTo);
  }

  const { publisherId, viewAs } = resolved;

  let initialCurrency: "USD" | "BDT" = "USD";
  if (viewAs) {
    const { data: pubProfile } = await supabase
      .from("profiles")
      .select("preferred_currency")
      .eq("publisher_id", publisherId)
      .eq("role", "publisher")
      .maybeSingle();
    initialCurrency = pubProfile?.preferred_currency === "BDT" ? "BDT" : "USD";
  } else {
    const { data: profile } = await supabase
      .from("profiles")
      .select("preferred_currency")
      .eq("id", resolved.user.id)
      .single();
    initialCurrency =
      profile && "preferred_currency" in profile && profile.preferred_currency === "BDT"
        ? "BDT"
        : "USD";
  }

  let publisherDisplayName = "Publisher";
  if (viewAs) {
    const { data: pub } = await supabase
      .from("publishers")
      .select("name")
      .eq("id", publisherId)
      .maybeSingle();
    if (pub?.name) publisherDisplayName = pub.name as string;
  }

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
    { href: "/dashboard/payments#invoices", label: "Payments & invoices" },
    { href: "/dashboard/support", label: "Support", support: true },
  ] as const;

  return (
    <div className="min-h-screen flex">
      <aside className="w-64 flex flex-col bg-[#121212] text-red-50 border-r border-red-950 shadow-[inset_-1px_0_0_rgba(220,56,45,0.22)]">
        <div className="px-4 py-5 border-b border-red-900/50 bg-gradient-to-br from-[#121212] via-[#1a0a0a] to-[#121212]">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#f55f4e]">
            Workspace
          </p>
          <p className="text-xl font-bold text-white mt-1.5 tracking-tight">Publisher</p>
        </div>
        <nav className="p-3 flex-1 space-y-1">
          {nav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="block px-3 py-3 rounded-lg text-base font-medium text-red-100/95 hover:bg-[#DC382D]/20 hover:text-white transition-colors"
            >
              <span className="inline-flex items-center gap-1">
                {item.label}
                {"support" in item && item.support && (
                  <PublisherSupportIndicator initialHasNew={hasUnreadSupport} />
                )}
              </span>
            </Link>
          ))}
        </nav>
        <form action="/auth/signout" method="post" className="p-3 border-t border-red-950/90">
          <button
            type="submit"
            className="w-full text-left px-3 py-3 rounded-lg text-base font-medium text-red-300/90 hover:bg-red-950/80 hover:text-white transition-colors"
          >
            Sign out
          </button>
        </form>
      </aside>
      <main className="flex-1 p-6 bg-stone-50 overflow-auto">
        <CurrencyProvider
          initialCurrency={initialCurrency}
          persistCurrency={!viewAs}
        >
          {viewAs && <ViewAsPublisherBanner publisherName={publisherDisplayName} />}
          <div className="flex items-center justify-end gap-4 mb-4">
            <CurrencyToggle />
          </div>
          {children}
        </CurrencyProvider>
      </main>
    </div>
  );
}
