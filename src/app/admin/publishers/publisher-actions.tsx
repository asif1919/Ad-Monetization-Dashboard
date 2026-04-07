"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useToast } from "@/components/ui/toast-provider";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

type Props = { publisherId: string; status: string; name: string };

function randomPassword() {
  const chars =
    "abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789!@#$%";
  let s = "";
  const arr = new Uint8Array(16);
  crypto.getRandomValues(arr);
  for (let i = 0; i < 16; i++) {
    s += chars[arr[i]! % chars.length];
  }
  return s;
}

export function PublisherActions({ publisherId, status, name }: Props) {
  const router = useRouter();
  const { show } = useToast();
  const [resetOpen, setResetOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");
  const [resetLoading, setResetLoading] = useState(false);
  const [viewLoading, setViewLoading] = useState(false);

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

  async function viewAsPublisher() {
    setViewLoading(true);
    try {
      const res = await fetch("/api/admin/view-as", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ publisherId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        show({
          type: "error",
          title: "Could not open publisher view",
          description: (data as { error?: string }).error ?? "Please try again.",
        });
        return;
      }
      router.push("/dashboard");
      router.refresh();
    } finally {
      setViewLoading(false);
    }
  }

  async function submitResetPassword() {
    if (password.length < 8) {
      show({ type: "error", title: "Password must be at least 8 characters" });
      return;
    }
    if (password !== password2) {
      show({ type: "error", title: "Passwords do not match" });
      return;
    }
    setResetLoading(true);
    try {
      const res = await fetch(`/api/admin/publishers/${publisherId}/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        show({
          type: "success",
          title: "Password updated",
          description: "Share the new password with the publisher securely.",
        });
        setResetOpen(false);
        setPassword("");
        setPassword2("");
      } else {
        show({
          type: "error",
          title: "Could not reset password",
          description: (data as { error?: string }).error ?? "Please try again.",
        });
      }
    } finally {
      setResetLoading(false);
    }
  }

  return (
    <span className="flex flex-wrap items-center gap-2">
      <Link
        href={`/admin/publishers/${publisherId}/edit`}
        className="text-blue-600 hover:underline"
      >
        Edit
      </Link>
      <button
        type="button"
        onClick={viewAsPublisher}
        disabled={viewLoading}
        className="text-indigo-600 hover:underline disabled:opacity-50"
      >
        {viewLoading ? "Opening…" : "View as publisher"}
      </button>
      <button
        type="button"
        onClick={() => setResetOpen(true)}
        className="text-slate-700 hover:underline"
      >
        Reset password
      </button>
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
      {resetOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div
            className="w-full max-w-md rounded-lg bg-white p-6 shadow-lg border border-gray-200"
            role="dialog"
            aria-labelledby="reset-password-title"
          >
            <h2 id="reset-password-title" className="text-lg font-semibold text-gray-900">
              Reset password (recovery)
            </h2>
            <p className="mt-1 text-sm text-gray-600">
              Use when the publisher forgot their password and asked you to set a new one. Share
              the new password with them outside this app.
            </p>
            <div className="mt-4 space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  New password
                </label>
                <input
                  type="password"
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Confirm password
                </label>
                <input
                  type="password"
                  autoComplete="new-password"
                  value={password2}
                  onChange={(e) => setPassword2(e.target.value)}
                  className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
                />
              </div>
              <button
                type="button"
                onClick={() => {
                  const p = randomPassword();
                  setPassword(p);
                  setPassword2(p);
                }}
                className="text-sm text-blue-600 hover:underline"
              >
                Generate strong password
              </button>
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setResetOpen(false);
                  setPassword("");
                  setPassword2("");
                }}
                className="rounded px-3 py-2 text-sm text-gray-700 hover:bg-gray-100"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={submitResetPassword}
                disabled={resetLoading}
                className="rounded bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {resetLoading ? "Saving…" : "Update password"}
              </button>
            </div>
          </div>
        </div>
      )}
    </span>
  );
}
