"use client";

type Row = {
  stat_date: string;
  impressions: number;
  clicks: number;
  revenue: number;
  ecpm: number;
};

export function ReportsTable({
  rows,
  from,
  to,
  summary,
}: {
  rows: Row[];
  from: string;
  to: string;
  summary: { impressions: number; clicks: number; revenue: number; ecpm: number };
}) {
  return (
    <div className="space-y-4">
      <form method="get" className="flex flex-wrap gap-4 items-end">
        <div>
          <label className="block text-sm text-gray-900 mb-1">From</label>
          <input
            type="date"
            name="from"
            defaultValue={from}
            className="rounded border border-gray-300 px-3 py-2 bg-white text-gray-900"
          />
        </div>
        <div>
          <label className="block text-sm text-gray-900 mb-1">To</label>
          <input
            type="date"
            name="to"
            defaultValue={to}
            className="rounded border border-gray-300 px-3 py-2 bg-white text-gray-900"
          />
        </div>
        <button
          type="submit"
          className="rounded bg-blue-600 px-4 py-2 text-white text-sm font-medium hover:bg-blue-700"
        >
          Apply
        </button>
      </form>
      <div className="rounded-lg bg-white border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="text-left p-3">Date</th>
              <th className="text-right p-3">Impressions</th>
              <th className="text-right p-3">Clicks</th>
              <th className="text-right p-3">Revenue</th>
              <th className="text-right p-3">eCPM</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.stat_date} className="border-b border-gray-100">
                <td className="p-3">{r.stat_date}</td>
                <td className="p-3 text-right">{Number(r.impressions).toLocaleString()}</td>
                <td className="p-3 text-right">{Number(r.clicks).toLocaleString()}</td>
                <td className="p-3 text-right">${Number(r.revenue).toFixed(2)}</td>
                <td className="p-3 text-right">${Number(r.ecpm).toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="bg-gray-50 font-medium">
              <td className="p-3">Total</td>
              <td className="p-3 text-right">{summary.impressions.toLocaleString()}</td>
              <td className="p-3 text-right">{summary.clicks.toLocaleString()}</td>
              <td className="p-3 text-right">${summary.revenue.toFixed(2)}</td>
              <td className="p-3 text-right">${summary.ecpm.toFixed(2)}</td>
            </tr>
          </tfoot>
        </table>
        {rows.length === 0 && (
          <p className="p-4 text-gray-600">No data for this range.</p>
        )}
      </div>
    </div>
  );
}
