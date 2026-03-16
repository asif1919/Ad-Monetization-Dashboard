"use client";

import { useState } from "react";
import Link from "next/link";

type TicketRow = {
  id: string;
  subject: string;
  status: "open" | "closed";
  created_at: string | null;
  publisher_name: string;
  publisher_email: string;
};

export function SupportStatusTabs({ tickets }: { tickets: TicketRow[] }) {
  const [active, setActive] = useState<"open" | "closed">("open");

  const openTickets = tickets.filter((t) => t.status === "open");
  const closedTickets = tickets.filter((t) => t.status === "closed");
  const visible = active === "open" ? openTickets : closedTickets;

  return (
    <div>
      <div className="inline-flex rounded-md border border-gray-200 bg-white text-xs font-medium overflow-hidden">
        <button
          type="button"
          onClick={() => setActive("open")}
          className={`px-3 py-1.5 border-r border-gray-200 ${
            active === "open" ? "bg-blue-50 text-blue-700" : "bg-white text-gray-700"
          }`}
        >
          Open ({openTickets.length})
        </button>
        <button
          type="button"
          onClick={() => setActive("closed")}
          className={`px-3 py-1.5 ${
            active === "closed" ? "bg-blue-50 text-blue-700" : "bg-white text-gray-700"
          }`}
        >
          Closed ({closedTickets.length})
        </button>
      </div>

      <div className="mt-3 rounded-lg bg-white border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="text-left p-3">Subject</th>
              <th className="text-left p-3">Publisher name</th>
              <th className="text-left p-3">Publisher email</th>
              <th className="text-left p-3">Status</th>
              <th className="text-left p-3">Created</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((t) => (
              <tr key={t.id} className="border-b border-gray-100">
                <td className="p-3">
                  <Link
                    href={`/admin/support/${t.id}`}
                    className="text-blue-600 hover:underline"
                  >
                    {t.subject}
                  </Link>
                </td>
                <td className="p-3 text-gray-700">
                  {t.publisher_name || "Unknown publisher"}
                </td>
                <td className="p-3 text-gray-600">
                  {t.publisher_email || "—"}
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
              </tr>
            ))}
          </tbody>
        </table>
        {visible.length === 0 && (
          <p className="p-4 text-gray-600">
            {active === "open" ? "No open tickets." : "No closed tickets."}
          </p>
        )}
      </div>
    </div>
  );
}

