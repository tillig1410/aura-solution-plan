"use client";

import { useMemo } from "react";
import type { Practitioner, Booking } from "@/types/supabase";

interface BookingWithDetails extends Booking {
  client: { id: string; name: string | null; phone: string | null; preferred_language: string; notes: string | null; loyalty_tier: string; loyalty_points: number } | null;
  practitioner: { id: string; name: string; color: string } | null;
  service: { id: string; name: string; duration_minutes: number; price_cents: number } | null;
}

interface MonthViewProps {
  bookings: BookingWithDetails[];
  practitioners: Practitioner[];
  month: Date;
  onDayClick: (d: Date) => void;
}

const DAY_LABELS = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];

// Default working capacity per practitioner per day (minutes)
const DEFAULT_CAPACITY_MIN = 10 * 60; // 10h (ex: 8h-19h minus 1h break)

const startOfMonth = (date: Date): Date =>
  new Date(date.getFullYear(), date.getMonth(), 1);

const startOfWeekMonday = (date: Date): Date => {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
};

const buildCalendarGrid = (month: Date): Date[] => {
  const firstDay = startOfMonth(month);
  const gridStart = startOfWeekMonday(firstDay);
  const grid: Date[] = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(gridStart);
    d.setDate(d.getDate() + i);
    grid.push(d);
  }
  return grid;
};

const isSameDay = (a: Date, b: Date): boolean =>
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() &&
  a.getDate() === b.getDate();

const fillColor = (rate: number): string => {
  if (rate <= 0) return "";
  if (rate < 0.5) return "bg-green-50/60";
  if (rate < 0.8) return "bg-amber-50/60";
  return "bg-red-50/60";
};

const barColor = (rate: number): string => {
  if (rate < 0.5) return "bg-green-400";
  if (rate < 0.8) return "bg-amber-400";
  return "bg-red-400";
};

const MonthView = ({ bookings, practitioners, month, onDayClick }: MonthViewProps) => {
  const today = useMemo(() => new Date(), []);
  const grid = useMemo(() => buildCalendarGrid(month), [month]);
  const activePracs = useMemo(() => practitioners.filter((p) => p.is_active), [practitioners]);

  const bookingsByDay = useMemo(() => {
    const map = new Map<string, BookingWithDetails[]>();
    for (const b of bookings) {
      const key = new Date(b.starts_at).toDateString();
      const existing = map.get(key) ?? [];
      existing.push(b);
      map.set(key, existing);
    }
    return map;
  }, [bookings]);

  const currentMonth = month.getMonth();

  return (
    <div className="flex flex-col h-full select-none">
      {/* Day-of-week header */}
      <div className="grid grid-cols-7 border-b bg-white">
        {DAY_LABELS.map((label, idx) => (
          <div
            key={label}
            className={`py-2 text-center text-xs font-medium uppercase tracking-wide ${
              idx === 6 ? "text-gray-400" : "text-gray-500"
            }`}
          >
            {label}
          </div>
        ))}
      </div>

      {/* 6-week grid */}
      <div className="flex-1 grid grid-cols-7 grid-rows-6 border-l border-t">
        {grid.map((day, idx) => {
          const isCurrentMonth = day.getMonth() === currentMonth;
          const isToday = isSameDay(day, today);
          const isSunday = idx % 7 === 6;
          const dayKey = day.toDateString();
          const dayBookings = bookingsByDay.get(dayKey) ?? [];

          // Skip capacity calc for Sunday or empty
          const activeCount = isSunday ? 0 : activePracs.length;
          const totalCapacity = activeCount * DEFAULT_CAPACITY_MIN;

          // Booked minutes
          const bookedMinutes = dayBookings.reduce((sum, b) => {
            if (b.status === "cancelled" || b.status === "no_show") return sum;
            return sum + (b.service?.duration_minutes ?? 30);
          }, 0);

          const fillRate = totalCapacity > 0 ? Math.min(bookedMinutes / totalCapacity, 1) : 0;
          const fillPct = Math.round(fillRate * 100);

          // Per-practitioner stats
          const pracStats = activePracs.map((p) => {
            const pracBookings = dayBookings.filter(
              (b) => b.practitioner_id === p.id && b.status !== "cancelled" && b.status !== "no_show"
            );
            const mins = pracBookings.reduce((s, b) => s + (b.service?.duration_minutes ?? 30), 0);
            const rate = Math.min(mins / DEFAULT_CAPACITY_MIN, 1);
            return { id: p.id, name: p.name, color: p.color, count: pracBookings.length, rate };
          }).filter((s) => !isSunday);

          const bgClass = isCurrentMonth && !isSunday ? fillColor(fillRate) : "";

          const confirmedCount = dayBookings.filter((b) => b.status === "confirmed" || b.status === "in_progress" || b.status === "completed").length;
          const pendingCount = dayBookings.filter((b) => b.status === "pending").length;

          return (
            <button
              key={dayKey}
              onClick={() => onDayClick(day)}
              className={`relative border-r border-b p-1.5 text-left transition-colors flex flex-col overflow-hidden ${
                isCurrentMonth ? "hover:brightness-95" : "bg-gray-50/60"
              } ${isSunday ? "bg-gray-50/80" : ""} ${bgClass}`}
            >
              {/* Day number */}
              <div className="flex items-center justify-between w-full">
                <div
                  className={`flex h-6 w-6 items-center justify-center rounded-full text-sm font-bold shrink-0 ${
                    isToday
                      ? "bg-indigo-600 text-white"
                      : isCurrentMonth
                      ? "text-gray-800"
                      : "text-gray-400"
                  } ${isSunday && !isToday ? "text-gray-400" : ""}`}
                >
                  {day.getDate()}
                </div>

                {/* Stats badges like Résumé du jour */}
                {!isSunday && (
                  <div className="flex items-center gap-0.5">
                    <span className={`text-[11px] font-bold rounded px-1 py-0.5 ${dayBookings.length > 0 ? "text-indigo-600 bg-indigo-50" : "text-gray-300 bg-gray-50"}`}>
                      {dayBookings.length}
                    </span>
                    {confirmedCount > 0 && (
                      <span className="text-[11px] font-bold text-green-600 bg-green-50 rounded px-1 py-0.5 flex items-center gap-0.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-green-500" />{confirmedCount}
                      </span>
                    )}
                    {pendingCount > 0 && (
                      <span className="text-[11px] font-bold text-amber-600 bg-amber-50 rounded px-1 py-0.5 flex items-center gap-0.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />{pendingCount}
                      </span>
                    )}
                  </div>
                )}
              </div>

              {/* Global fill gauge — always visible on working days */}
              {!isSunday && (
                <div className="flex items-center gap-1.5 mt-1">
                  <div className="flex-1 h-2 rounded-full bg-gray-100">
                    <div
                      className={`h-full rounded-full transition-all ${barColor(fillRate)}`}
                      style={{ width: `${fillPct}%` }}
                    />
                  </div>
                  <span className={`text-xs font-bold shrink-0 ${fillRate >= 0.8 ? "text-red-500" : fillRate >= 0.5 ? "text-amber-500" : "text-green-500"}`}>
                    {fillPct}%
                  </span>
                </div>
              )}

              {/* Per-practitioner mini bars — always visible on working days */}
              {!isSunday && pracStats.length > 0 && (
                <div className="mt-1.5 flex flex-col gap-1 flex-1 min-h-0 overflow-hidden">
                  {pracStats.slice(0, 4).map((ps) => (
                    <div key={ps.id} className="flex items-center gap-1">
                      <span
                        className="w-2.5 h-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: ps.color }}
                      />
                      <div className="flex-1 h-2 rounded-full bg-gray-100 min-w-0">
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${Math.round(ps.rate * 100)}%`,
                            backgroundColor: ps.color,
                            opacity: ps.count > 0 ? 1 : 0.2,
                          }}
                        />
                      </div>
                      <span className="text-xs font-bold text-gray-600 shrink-0">{ps.count}</span>
                    </div>
                  ))}
                  {pracStats.length > 4 && (
                    <span className="text-[10px] text-gray-400">+{pracStats.length - 4}</span>
                  )}
                </div>
              )}

              {/* Sunday */}
              {isSunday && (
                <div className="flex-1 flex items-center justify-center">
                  <span className="text-[9px] text-gray-400">Fermé</span>
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default MonthView;
