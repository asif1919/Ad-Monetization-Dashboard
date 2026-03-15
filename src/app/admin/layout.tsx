import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";

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

  const nav = [
    { href: "/admin", label: "Overview" },
    { href: "/admin/publishers", label: "Publishers" },
    { href: "/admin/domains", label: "Domains" },
    { href: "/admin/config", label: "Revenue config" },
    { href: "/admin/import", label: "Import Excel" },
    { href: "/admin/payouts", label: "Payouts" },
    { href: "/admin/invoices", label: "Invoices" },
  ];

  return (
    <div className="min-h-screen flex">
      <aside className="w-56 bg-gray-900 text-white flex flex-col">
        <div className="p-4 font-semibold border-b border-gray-700">
          Admin
        </div>
        <nav className="p-2 flex-1">
          {nav.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              className="block px-3 py-2 rounded hover:bg-gray-800 text-sm"
            >
              {label}
            </Link>
          ))}
        </nav>
        <div className="p-2 border-t border-gray-700">
          <form action="/auth/signout" method="post">
            <button
              type="submit"
              className="w-full text-left px-3 py-2 rounded hover:bg-gray-800 text-sm"
            >
              Sign out
            </button>
          </form>
        </div>
      </aside>
      <main className="flex-1 p-6 bg-gray-50 overflow-auto">{children}</main>
    </div>
  );
}
