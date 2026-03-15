"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function PayoutActions({
  payoutId,
  status,
}: {
  payoutId: string;
  status: string;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function markPaid() {
    setLoading(true);
    const res = await fetch(`/api/admin/payouts/${payoutId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "paid", paid_at: new Date().toISOString() }),
    });
    setLoading(false);
    if (res.ok) router.refresh();
  }

  if (status === "paid") return <span className="text-gray-600">—</span>;
  return (
    <button
      type="button"
      onClick={markPaid}
      disabled={loading}
      className="text-blue-600 hover:underline disabled:opacity-50"
    >
      Mark paid
    </button>
  );
}
