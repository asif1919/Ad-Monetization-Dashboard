import { createClient } from "@/lib/supabase/server";
import Link from "next/link";

export default async function DomainsPage() {
  const supabase = await createClient();
  const { data: domains } = await supabase
    .from("domains")
    .select("id, publisher_id, domain_site_id, display_name, publishers(name)")
    .order("domain_site_id");

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-semibold text-gray-900">Domains</h1>
        <Link
          href="/admin/domains/new"
          className="rounded bg-blue-600 px-4 py-2 text-white text-sm font-medium hover:bg-blue-700"
        >
          Add domain
        </Link>
      </div>
      <div className="rounded-lg bg-white border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="text-left p-3">Domain / Site ID</th>
              <th className="text-left p-3">Display name</th>
              <th className="text-left p-3">Publisher</th>
              <th className="text-left p-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {(domains ?? []).map((d) => (
              <tr key={d.id} className="border-b border-gray-100">
                <td className="p-3 font-medium">{d.domain_site_id}</td>
                <td className="p-3 text-gray-600">{d.display_name ?? "—"}</td>
                <td className="p-3">
                  {(d.publishers as { name?: string } | null)?.name ?? "—"}
                </td>
                <td className="p-3">
                  <Link
                    href={`/admin/domains/${d.id}/edit`}
                    className="text-blue-600 hover:underline"
                  >
                    Edit
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {(!domains || domains.length === 0) && (
          <p className="p-4 text-gray-600">No domains yet. Add one to match Excel rows.</p>
        )}
      </div>
    </div>
  );
}
