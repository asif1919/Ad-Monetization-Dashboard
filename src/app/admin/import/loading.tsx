export default function Loading() {
  return (
    <div className="flex items-center justify-center gap-2 p-12">
      <div className="loading-spinner" aria-hidden />
      <span className="text-gray-600">Loading…</span>
    </div>
  );
}
