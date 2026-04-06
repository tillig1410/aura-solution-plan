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

const startOfMonth = (date: Date): Date =>
  new Date(date.getFullYear(), date.getMonth(), 1);

const startOfWeekMonday = (date: Date): Date => {
  const d = new Date(date);
  const day = d.getDay();
  const diff = (day === 0 ? -6 : 1 - day);
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

const MonthView = ({ bookings, practitioners, month, onDayClick }: MonthViewProps) => {
  const today = useMemo(() => new Date(), []);
  const grid = useMemo(() => buildCalendarGrid(month), [month]);

  const practitionerMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const p of practitioners) {
      map.set(p.id, p.color);
    }
    return map;
  }, [practitioners]);

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

          // Gather unique practitioner colors for this day (max 5 dots)
          const practColorSet = new Set<string>();
          for (const b of dayBookings) {
            const color =
              b.practitioner?.color ?? practitionerMap.get(b.practitioner_id) ?? "#6366f1";
            practColorSet.add(color);
          }
          const dots = Array.from(practColorSet).slice(0, 5);

          return (
            <button
              key={dayKey}
              onClick={() => onDayClick(day)}
              className={`relative border-r border-b p-1.5 text-left transition-colors ${
                isCurrentMonth ? "bg-white hover:bg-gray-50" : "bg-gray-50/60 hover:bg-gray-100/60"
              } ${isSunday ? "bg-gray-50/80" : ""}`}
            >
              {/* Day number */}
              <div
                className={`flex h-6 w-6 items-center justify-center rounded-full text-sm font-medium ${
                  isToday
                    ? "bg-indigo-600 text-white"
                    : isCurrentMonth
                    ? "text-gray-800"
                    : "text-gray-400"
                } ${isSunday && !isToday ? "text-gray-400" : ""}`}
              >
                {day.getDate()}
              </div>

              {/* Booking count label */}
              {dayBookings.length > 0 && (
                <div className="mt-1 text-[10px] text-gray-500 font-medium">
                  {dayBookings.length} RDV
                </div>
              )}

              {/* Practitioner color dots */}
              {dots.length > 0 && (
                <div className="mt-1 flex flex-wrap gap-0.5">
                  {dots.map((color) => (
                    <span
                      key={color}
                      className="h-2 w-2 rounded-full shrink-0"
                      style={{ backgroundColor: color }}
                    />
                  ))}
                  {practColorSet.size > 5 && (
                    <span className="text-[9px] text-gray-400">+{practColorSet.size - 5}</span>
                  )}
                </div>
              )}

              {/* Closed label for Sunday */}
              {isSunday && (
                <div className="absolute inset-x-0 bottom-1 flex justify-center">
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
