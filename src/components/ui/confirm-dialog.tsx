"use client";

import { useState } from "react";

type ConfirmDialogProps = {
  trigger: (open: () => void) => React.ReactNode;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => Promise<void> | void;
};

export function ConfirmDialog({
  trigger,
  title,
  message,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  onConfirm,
}: ConfirmDialogProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleConfirm() {
    setLoading(true);
    try {
      await onConfirm();
      setOpen(false);
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      {trigger(() => setOpen(true))}
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
          role="dialog"
          aria-modal="true"
        >
          <div className="max-w-md w-full rounded-lg bg-white shadow-lg p-5">
            <h2 className="text-sm font-semibold text-gray-900 mb-2">{title}</h2>
            <p className="text-sm text-gray-700 mb-4">{message}</p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="px-3 py-1.5 rounded border border-gray-300 text-sm text-gray-700 hover:bg-gray-50"
                disabled={loading}
              >
                {cancelLabel}
              </button>
              <button
                type="button"
                onClick={handleConfirm}
                className="px-3 py-1.5 rounded bg-red-600 text-sm text-white hover:bg-red-700 disabled:opacity-50"
                disabled={loading}
              >
                {loading ? "Deleting…" : confirmLabel}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

