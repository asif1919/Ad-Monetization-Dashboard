import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { PublisherActions } from "./publisher-actions";

export default async function PublishersPage() {
  const supabase = await createClient();
  const { data: publishers } = await supabase
    .from("publishers")
    .select("id, name, email, revenue_share_pct, status, created_at")
    .order("name");

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-semibold text-gray-900">Publishers</h1>
        <Link
          href="/admin/publishers/new"
          className="rounded bg-blue-600 px-4 py-2 text-white text-sm font-medium hover:bg-blue-700"
        >
          Add publisher
        </Link>
      </div>
      <div className="rounded-lg bg-white border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="text-left p-3">Name</th>
              <th className="text-left p-3">Email</th>
              <th className="text-left p-3">Revenue share %</th>
              <th className="text-left p-3">Status</th>
              <th className="text-left p-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {(publishers ?? []).map((p) => (
              <tr key={p.id} className="border-b border-gray-100">
                <td className="p-3 font-medium">{p.name}</td>
                <td className="p-3 text-gray-600">{p.email}</td>
                <td className="p-3">{Number(p.revenue_share_pct)}%</td>
                <td className="p-3">
                  <span
                    className={
                      p.status === "active"
                        ? "text-green-600"
                        : "text-amber-600"
                    }
                  >
                    {p.status}
                  </span>
                </td>
                <td className="p-3">
                  <PublisherActions
                    publisherId={p.id}
                    status={p.status}
                    name={p.name}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {(!publishers || publishers.length === 0) && (
          <p className="p-4 text-gray-600">No publishers yet. Add one to get started.</p>
        )}
      </div>
    </div>
  );
}
