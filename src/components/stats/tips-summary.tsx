"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell,
  ResponsiveContainer,
} from "recharts";
import { formatEuros } from "@/lib/utils";

interface TipsByPractitioner {
  practitioner_id: string;
  name: string;
  color: string;
  total_cents: number;
  count: number;
}

interface TopTippingClient {
  client_id: string;
  name: string | null;
  total_cents: number;
}

interface TipsSummaryProps {
  tips: TipsByPractitioner[];
  topClients: TopTippingClient[];
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: { value: number; payload: TipsByPractitioner & { euros: number } }[];
  label?: string;
}

const CustomTooltip = ({ active, payload, label }: CustomTooltipProps) => {
  if (!active || !payload || payload.length === 0) return null;
  const entry = payload[0];
  return (
    <div className="rounded-lg border border-gray-200 bg-white px-3 py-2 shadow-md text-xs">
      <p className="font-medium text-gray-700 mb-0.5">{label}</p>
      <p className="text-indigo-600 font-semibold">{formatEuros(entry.value * 100)}</p>
      <p className="text-gray-400">{entry.payload.count} pourboire{entry.payload.count > 1 ? "s" : ""}</p>
    </div>
  );
};

const TipsSummary = ({ tips, topClients }: TipsSummaryProps) => {
  const totalCents = tips.reduce((s, t) => s + t.total_cents, 0);
  const totalCount = tips.reduce((s, t) => s + t.count, 0);
  const avgCents = totalCount > 0 ? Math.round(totalCents / totalCount) : 0;

  const chartData = tips.map((t) => ({
    ...t,
    euros: t.total_cents / 100,
  }));

  return (
    <div className="flex flex-col gap-5">
      {/* Summary stats */}
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl bg-indigo-50 px-4 py-3">
          <p className="text-xs text-indigo-500 mb-0.5">Total pourboires</p>
          <p className="text-xl font-bold text-indigo-700">{formatEuros(totalCents)}</p>
          <p className="text-xs text-indigo-400 mt-0.5">{totalCount} pourboire{totalCount > 1 ? "s" : ""}</p>
        </div>
        <div className="rounded-xl bg-purple-50 px-4 py-3">
          <p className="text-xs text-purple-500 mb-0.5">Moyenne / pourboire</p>
          <p className="text-xl font-bold text-purple-700">{formatEuros(avgCents)}</p>
          <p className="text-xs text-purple-400 mt-0.5">par transaction</p>
        </div>
      </div>

      {/* Bar chart */}
      {tips.length > 0 ? (
        <div>
          <p className="text-xs font-medium text-gray-500 mb-2">Par praticien</p>
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={chartData} margin={{ top: 4, right: 4, bottom: 0, left: 0 }} barSize={28}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
              <XAxis
                dataKey="name"
                tick={{ fontSize: 11, fill: "#9ca3af" }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tickFormatter={(v: number) => `${v} €`}
                tick={{ fontSize: 11, fill: "#9ca3af" }}
                axisLine={false}
                tickLine={false}
                width={48}
              />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: "#f3f4f6" }} />
              <Bar dataKey="euros" radius={[4, 4, 0, 0]}>
                {chartData.map((entry, idx) => (
                  <Cell key={`cell-${idx}`} fill={entry.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <p className="text-sm text-gray-400 text-center py-4">
          Aucun pourboire pour cette période.
        </p>
      )}

      {/* Top 3 tipping clients */}
      {topClients.length > 0 && (
        <div>
          <p className="text-xs font-medium text-gray-500 mb-2">Top clients généreux</p>
          <div className="flex flex-col gap-1.5">
            {topClients.slice(0, 3).map((c, idx) => (
              <div
                key={c.client_id}
                className="flex items-center gap-2 rounded-lg bg-gray-50 px-3 py-2"
              >
                <span className="text-sm font-bold text-gray-300 w-5 text-center">
                  {idx + 1}
                </span>
                <span className="flex-1 text-sm font-medium text-gray-700 truncate">
                  {c.name ?? "Client anonyme"}
                </span>
                <span className="text-sm font-semibold text-indigo-600 shrink-0">
                  {formatEuros(c.total_cents)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default TipsSummary;
