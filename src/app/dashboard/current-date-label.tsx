"use client";

/** Fixed locale so server and client render the same string (avoids hydration mismatch). */
export function CurrentDateLabel() {
  return (
    <p className="text-xs text-gray-600 mb-2">
      {new Date().toLocaleDateString("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric",
      })}
    </p>
  );
}
