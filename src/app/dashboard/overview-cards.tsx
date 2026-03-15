"use client";

export function OverviewCards({
  todayRevenue,
  monthlyRevenue,
  impressions,
  clicks,
  ecpm,
  paymentDue,
}: {
  todayRevenue: number;
  monthlyRevenue: number;
  impressions: number;
  clicks: number;
  ecpm: number;
  paymentDue: number;
}) {
  const cards = [
    { label: "Today revenue", value: `$${todayRevenue.toFixed(2)}` },
    { label: "Monthly revenue", value: `$${monthlyRevenue.toFixed(2)}` },
    { label: "Impressions", value: impressions.toLocaleString() },
    { label: "Clicks", value: clicks.toLocaleString() },
    { label: "eCPM", value: `$${ecpm.toFixed(2)}` },
    { label: "Payment due", value: `$${paymentDue.toFixed(2)}` },
  ];
  return (
    <div className="grid gap-4 grid-cols-2 md:grid-cols-3 lg:grid-cols-6">
      {cards.map((c) => (
        <div
          key={c.label}
          className="rounded-lg bg-white p-4 border border-gray-200 shadow-sm"
        >
          <p className="text-sm text-gray-700">{c.label}</p>
          <p className="text-xl font-semibold text-gray-900 mt-1">{c.value}</p>
        </div>
      ))}
    </div>
  );
}
