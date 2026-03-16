"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/toast-provider";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

type Props = { publisherId: string; status: string; name: string };

export function PublisherActions({ publisherId, status, name }: Props) {
  const router = useRouter();
  const { show } = useToast();

  async function toggleSuspend() {
    const newStatus = status === "active" ? "suspended" : "active";
    const res = await fetch(`/api/admin/publishers/${publisherId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus }),
    });
    if (res.ok) {
      show({
        type: "success",
        title: newStatus === "active" ? "Publisher activated" : "Publisher suspended",
      });
      router.refresh();
    } else {
      show({
        type: "error",
        title: "Could not update status",
      });
    }
  }

  async function deletePublisherRequest() {
    const res = await fetch(`/api/admin/publishers/${publisherId}`, {
      method: "DELETE",
    });
    if (res.ok) {
      show({
        type: "success",
        title: "Publisher deleted",
        description: "The publisher and related data have been removed.",
      });
      router.refresh();
    } else {
      const data = await res.json().catch(() => ({}));
      show({
        type: "error",
        title: "Failed to delete publisher",
        description: data.error ?? "Please try again.",
      });
    }
  }

  return (
    <span className="flex items-center gap-2">
      <Link
        href={`/admin/publishers/${publisherId}/edit`}
        className="text-blue-600 hover:underline"
      >
        Edit
      </Link>
      <button
        type="button"
        onClick={toggleSuspend}
        className="text-amber-600 hover:underline"
      >
        {status === "active" ? "Suspend" : "Activate"}
      </button>
      <ConfirmDialog
        title="Delete publisher?"
        message={`Delete publisher "${name}"? Their login will be removed and all related data (domains, stats, payouts, invoices) will be deleted. This cannot be undone.`}
        confirmLabel="Delete"
        cancelLabel="Cancel"
        onConfirm={deletePublisherRequest}
        trigger={(open) => (
          <button
            type="button"
            onClick={open}
            className="text-red-600 hover:underline"
          >
            Delete
          </button>
        )}
      />
    </span>
  );
}

