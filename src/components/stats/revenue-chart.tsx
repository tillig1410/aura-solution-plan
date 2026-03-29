"use client";

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { formatEuros } from "@/lib/utils";

interface RevenueDataPoint {
  date: string;
  current_cents: number;
  previous_cents: number;
}

interface RevenueChartProps {
  data: RevenueDataPoint[];
  showComparison: boolean;
}

const formatDateLabel = (dateStr: string): string => {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
};

interface TooltipPayloadEntry {
  dataKey: string;
  value: number;
  color: string;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: TooltipPayloadEntry[];
  label?: string;
}

const CustomTooltip = ({ active, payload, label }: CustomTooltipProps) => {
  if (!active || !payload || payload.length === 0) return null;

  return (
    <div className="rounded-lg border border-gray-200 bg-white px-3 py-2 shadow-md text-xs">
      <p className="mb-1.5 font-medium text-gray-700">
        {label ? formatDateLabel(label) : ""}
      </p>
      {payload.map((entry) => (
        <div key={entry.dataKey} className="flex items-center gap-2">
          <span
            className="h-2 w-2 rounded-full shrink-0"
            style={{ backgroundColor: entry.color }}
          />
          <span className="text-gray-500">
            {entry.dataKey === "current_cents" ? "Période actuelle" : "Période précédente"}
          </span>
          <span className="ml-auto font-medium text-gray-800">
            {formatEuros(entry.value)}
          </span>
        </div>
      ))}
    </div>
  );
};

const RevenueChart = ({ data, showComparison }: RevenueChartProps) => {
  const chartData = data.map((d) => ({
    ...d,
    current: d.current_cents / 100,
    previous: d.previous_cents / 100,
  }));

  return (
    <ResponsiveContainer width="100%" height={240}>
      <AreaChart data={chartData} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
        <defs>
          <linearGradient id="colorCurrent" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#6366f1" stopOpacity={0.18} />
            <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
          </linearGradient>
          <linearGradient id="colorPrevious" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#9ca3af" stopOpacity={0.12} />
            <stop offset="95%" stopColor="#9ca3af" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
        <XAxis
          dataKey="date"
          tickFormatter={formatDateLabel}
          tick={{ fontSize: 11, fill: "#9ca3af" }}
          axisLine={false}
          tickLine={false}
          interval="preserveStartEnd"
        />
        <YAxis
          tickFormatter={(v: number) => `${v} €`}
          tick={{ fontSize: 11, fill: "#9ca3af" }}
          axisLine={false}
          tickLine={false}
          width={55}
        />
        <Tooltip content={<CustomTooltip />} />
        {showComparison && (
          <Area
            type="monotone"
            dataKey="previous"
            name="previous_cents"
            stroke="#d1d5db"
            strokeWidth={1.5}
            strokeDasharray="4 2"
            fill="url(#colorPrevious)"
            dot={false}
            activeDot={{ r: 4, fill: "#9ca3af" }}
          />
        )}
        <Area
          type="monotone"
          dataKey="current"
          name="current_cents"
          stroke="#6366f1"
          strokeWidth={2}
          fill="url(#colorCurrent)"
          dot={false}
          activeDot={{ r: 5, fill: "#6366f1" }}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
};

export default RevenueChart;
