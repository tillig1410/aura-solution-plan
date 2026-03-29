"use client";

import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import {
  TrendingUp,
  TrendingDown,
  Calendar,
  Star,
  Download,
  Loader2,
  BarChart2,
} from "lucide-react";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatEuros } from "@/lib/utils";
import RevenueChart from "@/components/stats/revenue-chart";
import BookingsChart from "@/components/stats/bookings-chart";
import PractitionerPerformance from "@/components/stats/practitioner-performance";
import TipsSummary from "@/components/stats/tips-summary";

// ---------- Types ----------

type Period = "today" | "week" | "month" | "quarter" | "year";

interface PeriodOption {
  value: Period;
  label: string;
}

const PERIOD_OPTIONS: PeriodOption[] = [
  { value: "today", label: "Aujourd'hui" },
  { value: "week", label: "Cette semaine" },
  { value: "month", label: "Ce mois" },
  { value: "quarter", label: "Ce trimestre" },
  { value: "year", label: "Cette année" },
];

interface StatsResponse {
  period: string;
  from: string;
  to: string;
  summary: {
    revenue_cents: number;
    revenue_delta_pct: number;
    bookings_count: number;
    bookings_delta_pct: number;
    fill_rate: number;
    fill_rate_delta_pts: number;
    tips_total_cents: number;
    tips_delta_pct: number;
  };
  revenue_by_day: { date: string; current_cents: number; previous_cents: number }[];
  bookings_by_day: { date: string; count: number; completed: number; cancelled: number }[];
  by_channel: { channel: string; count: number; pct: number }[];
  practitioners: {
    id: string;
    name: string;
    color: string;
    bookings_count: number;
    revenue_cents: number;
    fill_rate: number;
    tips_cents: number;
    top_service: string | null;
  }[];
  tips_by_practitioner: {
    practitioner_id: string;
    name: string;
    color: string;
    total_cents: number;
    count: number;
  }[];
  top_tipping_clients: { client_id: string; name: string | null; total_cents: number }[];
  clients: {
    new_count: number;
    new_delta_pct: number;
    return_rate: number;
    inactive_count: number;
  };
  top_clients_by_revenue: { client_id: string; name: string | null; revenue_cents: number }[];
  booking_patterns: {
    cancel_rate: number;
    noshow_rate: number;
    by_hour: { hour: number; count: number }[];
    by_day_of_week: { day: number; label: string; count: number }[];
  };
}

// ---------- Formatters ----------

const formatDelta = (pct: number): string => {
  if (pct > 0) return `+${pct}%`;
  if (pct < 0) return `${pct}%`;
  return "0%";
};

const formatDeltaPts = (pts: number): string => {
  if (pts > 0) return `+${pts} pts`;
  if (pts < 0) return `${pts} pts`;
  return "stable";
};

// ---------- Channel colors & labels ----------

const CHANNEL_COLORS: Record<string, string> = {
  whatsapp: "#25d366",
  messenger: "#0084ff",
  telegram: "#0088cc",
  sms: "#f59e0b",
  voice: "#8b5cf6",
  dashboard: "#6366f1",
  booking_page: "#ec4899",
};

const CHANNEL_LABELS: Record<string, string> = {
  whatsapp: "WhatsApp",
  messenger: "Messenger",
  telegram: "Telegram",
  sms: "SMS",
  voice: "Téléphone",
  dashboard: "Dashboard",
  booking_page: "Site réservation",
};

// ---------- KPI Card ----------

interface KpiCardProps {
  title: string;
  value: string;
  delta: number;
  deltaLabel: string;
  icon: React.ReactNode;
  positive?: "up" | "down"; // which direction is considered positive
}

const KpiCard = ({ title, value, delta, deltaLabel, icon, positive = "up" }: KpiCardProps) => {
  const isGood = positive === "up" ? delta >= 0 : delta <= 0;
  const DeltaIcon = delta >= 0 ? TrendingUp : TrendingDown;

  return (
    <Card size="sm">
      <CardContent className="pt-3">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-xs text-gray-500 mb-1">{title}</p>
            <p className="text-2xl font-bold text-gray-900 tabular-nums">{value}</p>
          </div>
          <div className="rounded-xl bg-indigo-50 p-2.5 text-indigo-600 shrink-0">{icon}</div>
        </div>
        <div
          className={`mt-2 flex items-center gap-1 text-xs font-medium ${
            isGood ? "text-green-600" : "text-red-500"
          }`}
        >
          <DeltaIcon className="h-3.5 w-3.5" />
          <span>{deltaLabel}</span>
          <span className="text-gray-400 font-normal">vs période préc.</span>
        </div>
      </CardContent>
    </Card>
  );
};

// ---------- CSV Export ----------

const exportToCsv = (stats: StatsResponse, period: Period): void => {
  const rows: string[][] = [
    ["Période", PERIOD_OPTIONS.find((o) => o.value === period)?.label ?? period],
    ["Du", stats.from],
    ["Au", stats.to],
    [],
    ["Résumé"],
    ["Chiffre d'affaires (€)", String(stats.summary.revenue_cents / 100)],
    ["Évolution CA (%)", String(stats.summary.revenue_delta_pct)],
    ["Nombre de RDV", String(stats.summary.bookings_count)],
    ["Évolution RDV (%)", String(stats.summary.bookings_delta_pct)],
    ["Taux de remplissage (%)", String(stats.summary.fill_rate)],
    ["Pourboires (€)", String(stats.summary.tips_total_cents / 100)],
    [],
    ["Revenus par jour", "CA courant (€)", "CA précédent (€)"],
    ...stats.revenue_by_day.map((d) => [d.date, String(d.current_cents / 100), String(d.previous_cents / 100)]),
    [],
    ["Performance praticiens", "RDV", "CA (€)", "Taux (%)", "Pourboires (€)", "Service phare"],
    ...stats.practitioners.map((p) => [
      p.name,
      String(p.bookings_count),
      String(p.revenue_cents / 100),
      String(p.fill_rate),
      String(p.tips_cents / 100),
      p.top_service ?? "",
    ]),
  ];

  const csv = rows.map((r) => r.map((c) => `"${c}"`).join(";")).join("\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `stats-${period}-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
};

// ---------- Page ----------

const StatsPage = () => {
  const [period, setPeriod] = useState<Period>("month");
  const [stats, setStats] = useState<StatsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showComparison, setShowComparison] = useState(true);

  const fetchStats = useCallback(async (p: Period) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/v1/stats?period=${p}`);
      if (!res.ok) {
        const body = (await res.json()) as { error?: string };
        throw new Error(body.error ?? "Erreur inconnue");
      }
      const data = (await res.json()) as StatsResponse;
      setStats(data);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erreur lors du chargement des statistiques";
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchStats(period);
  }, [period, fetchStats]);

  const handlePeriodChange = (p: Period) => {
    setPeriod(p);
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Statistiques</h1>
          <p className="text-sm text-gray-500">Vue d&apos;ensemble de votre activité</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* Period selector */}
          <div className="flex rounded-lg overflow-hidden border border-input">
            {PERIOD_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => handlePeriodChange(opt.value)}
                className={`px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
                  period === opt.value
                    ? "bg-indigo-600 text-white"
                    : "text-gray-600 hover:bg-gray-50"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
          {/* Export button */}
          <button
            disabled={!stats}
            onClick={() => stats && exportToCsv(stats, period)}
            className="flex items-center gap-1.5 rounded-lg border border-input bg-white px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Download className="h-3.5 w-3.5" />
            Export CSV
          </button>
        </div>
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-24">
          <Loader2 className="h-8 w-8 animate-spin text-indigo-400" />
        </div>
      )}

      {/* Error */}
      {!loading && error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-5 py-6 text-center">
          <p className="text-sm font-medium text-red-700">{error}</p>
          <button
            onClick={() => void fetchStats(period)}
            className="mt-3 text-xs text-red-600 underline"
          >
            Réessayer
          </button>
        </div>
      )}

      {/* Content */}
      {!loading && !error && stats && (
        <div className="flex flex-col gap-6">
          {/* 4 KPI cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            <KpiCard
              title="Chiffre d'affaires"
              value={formatEuros(stats.summary.revenue_cents)}
              delta={stats.summary.revenue_delta_pct}
              deltaLabel={formatDelta(stats.summary.revenue_delta_pct)}
              icon={<TrendingUp className="h-5 w-5" />}
            />
            <KpiCard
              title="Rendez-vous"
              value={String(stats.summary.bookings_count)}
              delta={stats.summary.bookings_delta_pct}
              deltaLabel={formatDelta(stats.summary.bookings_delta_pct)}
              icon={<Calendar className="h-5 w-5" />}
            />
            <KpiCard
              title="Taux de remplissage"
              value={`${stats.summary.fill_rate}%`}
              delta={stats.summary.fill_rate_delta_pts}
              deltaLabel={formatDeltaPts(stats.summary.fill_rate_delta_pts)}
              icon={<BarChart2 className="h-5 w-5" />}
            />
            <KpiCard
              title="Pourboires"
              value={formatEuros(stats.summary.tips_total_cents)}
              delta={stats.summary.tips_delta_pct}
              deltaLabel={formatDelta(stats.summary.tips_delta_pct)}
              icon={<Star className="h-5 w-5" />}
            />
          </div>

          {/* Revenue chart */}
          <Card size="sm">
            <CardHeader className="border-b">
              <div className="flex items-center justify-between gap-3">
                <CardTitle>Évolution du chiffre d&apos;affaires</CardTitle>
                <label className="flex items-center gap-1.5 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={showComparison}
                    onChange={(e) => setShowComparison(e.target.checked)}
                    className="h-3.5 w-3.5 rounded accent-indigo-600"
                  />
                  <span className="text-xs text-gray-500">Comparer période préc.</span>
                </label>
              </div>
            </CardHeader>
            <CardContent className="pt-4">
              <RevenueChart data={stats.revenue_by_day} showComparison={showComparison} />
            </CardContent>
          </Card>

          {/* Practitioner performance */}
          <Card size="sm">
            <CardHeader className="border-b">
              <CardTitle>Performance par praticien</CardTitle>
            </CardHeader>
            <CardContent className="pt-4">
              <PractitionerPerformance practitioners={stats.practitioners} />
            </CardContent>
          </Card>

          {/* Tips section */}
          <Card size="sm">
            <CardHeader className="border-b">
              <CardTitle>Pourboires</CardTitle>
            </CardHeader>
            <CardContent className="pt-4">
              <TipsSummary
                tips={stats.tips_by_practitioner}
                topClients={stats.top_tipping_clients}
              />
            </CardContent>
          </Card>

          {/* Channels + Clients row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Channels donut */}
            <Card size="sm">
              <CardHeader className="border-b">
                <CardTitle>Canaux de réservation</CardTitle>
              </CardHeader>
              <CardContent className="pt-4">
                {stats.by_channel.length === 0 ? (
                  <p className="text-sm text-gray-400 text-center py-6">
                    Aucune donnée pour cette période.
                  </p>
                ) : (
                  <div className="flex flex-col gap-4">
                    <ResponsiveContainer width="100%" height={200}>
                      <PieChart>
                        <Pie
                          data={stats.by_channel}
                          dataKey="count"
                          nameKey="channel"
                          cx="50%"
                          cy="50%"
                          innerRadius={55}
                          outerRadius={85}
                          paddingAngle={2}
                        >
                          {stats.by_channel.map((entry, idx) => (
                            <Cell
                              key={`cell-${idx}`}
                              fill={CHANNEL_COLORS[entry.channel] ?? "#6366f1"}
                            />
                          ))}
                        </Pie>
                        <Tooltip
                          formatter={(value, name) => [
                            `${value ?? 0} RDV`,
                            typeof name === "string" ? (CHANNEL_LABELS[name] ?? name) : (name ?? ""),
                          ]}
                        />
                        <Legend
                          formatter={(value: string) => CHANNEL_LABELS[value] ?? value}
                          iconType="circle"
                          iconSize={8}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="flex flex-col gap-1.5">
                      {stats.by_channel.map((ch) => (
                        <div key={ch.channel} className="flex items-center gap-2 text-xs">
                          <span
                            className="h-2.5 w-2.5 rounded-full shrink-0"
                            style={{ backgroundColor: CHANNEL_COLORS[ch.channel] ?? "#6366f1" }}
                          />
                          <span className="text-gray-600 flex-1">
                            {CHANNEL_LABELS[ch.channel] ?? ch.channel}
                          </span>
                          <span className="font-medium text-gray-700 tabular-nums">
                            {ch.count} RDV
                          </span>
                          <span className="text-gray-400 tabular-nums w-10 text-right">
                            {ch.pct}%
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Client stats */}
            <Card size="sm">
              <CardHeader className="border-b">
                <CardTitle>Clients</CardTitle>
              </CardHeader>
              <CardContent className="pt-4">
                <div className="grid grid-cols-2 gap-3 mb-4">
                  <div className="rounded-xl bg-blue-50 px-3 py-3 text-center">
                    <p className="text-2xl font-bold text-blue-700">
                      {stats.clients.new_count}
                    </p>
                    <p className="text-xs text-blue-500 mt-0.5">Nouveaux clients</p>
                    <p
                      className={`text-xs font-medium mt-1 ${
                        stats.clients.new_delta_pct >= 0 ? "text-green-600" : "text-red-500"
                      }`}
                    >
                      {formatDelta(stats.clients.new_delta_pct)}
                    </p>
                  </div>
                  <div className="rounded-xl bg-green-50 px-3 py-3 text-center">
                    <p className="text-2xl font-bold text-green-700">
                      {stats.clients.return_rate}%
                    </p>
                    <p className="text-xs text-green-500 mt-0.5">Taux de retour</p>
                    <p className="text-xs text-green-400 mt-1">clients fidèles</p>
                  </div>
                  <div className="rounded-xl bg-orange-50 px-3 py-3 text-center col-span-2">
                    <p className="text-2xl font-bold text-orange-700">
                      {stats.clients.inactive_count}
                    </p>
                    <p className="text-xs text-orange-500 mt-0.5">
                      Clients inactifs (&gt;90 jours)
                    </p>
                  </div>
                </div>

                {/* Top clients by revenue */}
                {stats.top_clients_by_revenue.length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-gray-500 mb-2">
                      Top 5 clients par CA
                    </p>
                    <div className="flex flex-col gap-1.5">
                      {stats.top_clients_by_revenue.map((c, idx) => (
                        <div
                          key={c.client_id}
                          className="flex items-center gap-2 rounded-lg bg-gray-50 px-3 py-1.5"
                        >
                          <span className="text-xs font-bold text-gray-300 w-4 text-center">
                            {idx + 1}
                          </span>
                          <span className="flex-1 text-xs font-medium text-gray-700 truncate">
                            {c.name ?? "Client anonyme"}
                          </span>
                          <span className="text-xs font-semibold text-indigo-600 tabular-nums shrink-0">
                            {formatEuros(c.revenue_cents)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* RDV Patterns */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card size="sm">
              <CardHeader className="border-b">
                <CardTitle>Tendances des RDV</CardTitle>
              </CardHeader>
              <CardContent className="pt-4">
                <div className="grid grid-cols-2 gap-3 mb-4">
                  <div className="rounded-xl bg-red-50 px-3 py-3 text-center">
                    <p className="text-2xl font-bold text-red-600">
                      {stats.booking_patterns.cancel_rate}%
                    </p>
                    <p className="text-xs text-red-400 mt-0.5">Taux d&apos;annulation</p>
                  </div>
                  <div className="rounded-xl bg-orange-50 px-3 py-3 text-center">
                    <p className="text-2xl font-bold text-orange-600">
                      {stats.booking_patterns.noshow_rate}%
                    </p>
                    <p className="text-xs text-orange-400 mt-0.5">Taux no-show</p>
                  </div>
                </div>
                <div>
                  <p className="text-xs font-medium text-gray-500 mb-2">
                    Par jour de la semaine
                  </p>
                  <div className="flex items-end gap-1 h-14">
                    {stats.booking_patterns.by_day_of_week.map((d) => {
                      const max = Math.max(
                        ...stats.booking_patterns.by_day_of_week.map((x) => x.count),
                        1,
                      );
                      const pct = Math.round((d.count / max) * 100);
                      return (
                        <div key={d.day} className="flex flex-col items-center gap-0.5 flex-1">
                          <div
                            className="w-full rounded-t bg-indigo-200 hover:bg-indigo-400 transition-colors"
                            style={{ height: `${Math.max(pct, 4)}%` }}
                            title={`${d.label}: ${d.count} RDV`}
                          />
                          <span className="text-[9px] text-gray-400">{d.label}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card size="sm">
              <CardHeader className="border-b">
                <CardTitle>RDV par heure</CardTitle>
              </CardHeader>
              <CardContent className="pt-4">
                <BookingsChart data={stats.booking_patterns.by_hour} />
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
};

export default StatsPage;
