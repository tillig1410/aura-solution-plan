"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

interface HourDataPoint {
  hour: number;
  count: number;
}

interface BookingsChartProps {
  data: HourDataPoint[];
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: { value: number }[];
  label?: number;
}

const CustomTooltip = ({ active, payload, label }: CustomTooltipProps) => {
  if (!active || !payload || payload.length === 0) return null;

  return (
    <div className="rounded-lg border border-gray-200 bg-white px-3 py-2 shadow-md text-xs">
      <p className="font-medium text-gray-700">{label}h — {label !== undefined ? label + 1 : ""}h</p>
      <p className="text-indigo-600 font-semibold mt-0.5">
        {payload[0].value} RDV
      </p>
    </div>
  );
};

const OPEN_HOUR = 8;
const CLOSE_HOUR = 21;

const BookingsChart = ({ data }: BookingsChartProps) => {
  const chartData = data
    .filter((d) => d.hour >= OPEN_HOUR && d.hour <= CLOSE_HOUR)
    .map((d) => ({
      hour: d.hour,
      label: `${d.hour}h`,
      count: d.count,
    }));

  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={chartData} margin={{ top: 8, right: 8, bottom: 0, left: 0 }} barSize={12}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
        <XAxis
          dataKey="label"
          tick={{ fontSize: 10, fill: "#9ca3af" }}
          axisLine={false}
          tickLine={false}
          interval={1}
        />
        <YAxis
          allowDecimals={false}
          tick={{ fontSize: 11, fill: "#9ca3af" }}
          axisLine={false}
          tickLine={false}
          width={30}
        />
        <Tooltip content={<CustomTooltip />} cursor={{ fill: "#f3f4f6" }} />
        <Bar dataKey="count" fill="#6366f1" radius={[3, 3, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
};

export default BookingsChart;
