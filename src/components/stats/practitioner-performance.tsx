"use client";

import { Trophy } from "lucide-react";
import { formatEuros } from "@/lib/utils";

interface PractitionerStat {
  id: string;
  name: string;
  color: string;
  bookings_count: number;
  revenue_cents: number;
  fill_rate: number;
  tips_cents: number;
  top_service: string | null;
}

interface PractitionerPerformanceProps {
  practitioners: PractitionerStat[];
}

const PractitionerPerformance = ({ practitioners }: PractitionerPerformanceProps) => {
  if (practitioners.length === 0) {
    return (
      <p className="text-sm text-gray-400 py-4 text-center">
        Aucune donnée pour cette période.
      </p>
    );
  }

  const topRevenue = Math.max(...practitioners.map((p) => p.revenue_cents));

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-100">
            <th className="text-left pb-2 pr-3 font-medium text-gray-500 text-xs">Praticien</th>
            <th className="text-right pb-2 px-3 font-medium text-gray-500 text-xs">RDV</th>
            <th className="text-right pb-2 px-3 font-medium text-gray-500 text-xs">CA</th>
            <th className="text-right pb-2 px-3 font-medium text-gray-500 text-xs">Taux</th>
            <th className="text-right pb-2 px-3 font-medium text-gray-500 text-xs">Pourboires</th>
            <th className="text-left pb-2 pl-3 font-medium text-gray-500 text-xs">Service phare</th>
          </tr>
        </thead>
        <tbody>
          {practitioners
            .slice()
            .sort((a, b) => b.revenue_cents - a.revenue_cents)
            .map((p) => {
              const isTop = p.revenue_cents === topRevenue && topRevenue > 0;
              return (
                <tr
                  key={p.id}
                  className="border-b border-gray-50 hover:bg-gray-50/60 transition-colors"
                >
                  <td className="py-2.5 pr-3">
                    <div className="flex items-center gap-2">
                      <span
                        className="h-3 w-3 rounded-full shrink-0"
                        style={{ backgroundColor: p.color }}
                      />
                      <span className="font-medium text-gray-800">{p.name}</span>
                      {isTop && (
                        <Trophy className="h-3.5 w-3.5 text-amber-400 shrink-0" aria-label="Top performer" />
                      )}
                    </div>
                  </td>
                  <td className="py-2.5 px-3 text-right tabular-nums text-gray-700">
                    {p.bookings_count}
                  </td>
                  <td className="py-2.5 px-3 text-right tabular-nums font-medium text-gray-800">
                    {formatEuros(p.revenue_cents)}
                  </td>
                  <td className="py-2.5 px-3 text-right">
                    <span
                      className={`text-xs font-medium rounded-full px-2 py-0.5 ${
                        p.fill_rate >= 80
                          ? "bg-green-100 text-green-700"
                          : p.fill_rate >= 50
                          ? "bg-yellow-100 text-yellow-700"
                          : "bg-red-100 text-red-600"
                      }`}
                    >
                      {p.fill_rate}%
                    </span>
                  </td>
                  <td className="py-2.5 px-3 text-right tabular-nums text-indigo-600 font-medium">
                    {formatEuros(p.tips_cents)}
                  </td>
                  <td className="py-2.5 pl-3 text-gray-500 text-xs truncate max-w-[140px]">
                    {p.top_service ?? <span className="text-gray-300">—</span>}
                  </td>
                </tr>
              );
            })}
        </tbody>
      </table>
    </div>
  );
};

export default PractitionerPerformance;
