"use client";

/** Shows the user's local current date (matches progressive "today" in the browser). */
export function CurrentDateLabel() {
  return (
    <p className="text-xs text-gray-600 mb-2">
      {new Date().toLocaleDateString(undefined, {
        month: "long",
        day: "numeric",
        year: "numeric",
      })}
    </p>
  );
}
