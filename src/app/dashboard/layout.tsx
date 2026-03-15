import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";

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

  const nav = [
    { href: "/dashboard", label: "Overview" },
    { href: "/dashboard/reports", label: "Reports" },
    { href: "/dashboard/payments", label: "Payments" },
  ];

  return (
    <div className="min-h-screen flex">
      <aside className="w-56 bg-gray-800 text-white flex flex-col">
        <div className="p-4 font-semibold border-b border-gray-700">
          Publisher Dashboard
        </div>
        <nav className="p-2 flex-1">
          {nav.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              className="block px-3 py-2 rounded hover:bg-gray-700 text-sm"
            >
              {label}
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
