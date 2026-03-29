"use client";

import { useMemo, useRef, useEffect, useState } from "react";
import { MessageSquare, Phone, Monitor } from "lucide-react";
import type { Practitioner, Booking } from "@/types/supabase";

interface BookingWithDetails extends Booking {
  client: { id: string; name: string | null; phone: string | null; preferred_language: string } | null;
  practitioner: { id: string; name: string; color: string } | null;
  service: { id: string; name: string; duration_minutes: number; price_cents: number } | null;
}

interface WeekViewProps {
  bookings: BookingWithDetails[];
  practitioners: Practitioner[];
  weekStart: Date;
  selectedPractitionerIds: string[];
  onBookingClick: (b: BookingWithDetails) => void;
}

const HOUR_START = 8;
const HOUR_END = 19;
const HOURS = Array.from({ length: HOUR_END - HOUR_START + 1 }, (_, i) => HOUR_START + i);
const PX_PER_MINUTE = 1;
const TOTAL_MINUTES = (HOUR_END - HOUR_START) * 60;

const DAY_LABELS = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];

const getChannelIcon = (channel: Booking["source_channel"]) => {
  if (channel === "voice") return <Phone className="h-3 w-3" />;
  if (channel === "dashboard" || channel === "booking_page") return <Monitor className="h-3 w-3" />;
  return <MessageSquare className="h-3 w-3" />;
};

const getStatusBorder = (status: Booking["status"]) => {
  switch (status) {
    case "confirmed": return "#22c55e";
    case "in_progress": return "#3b82f6";
    case "completed": return "#9ca3af";
    case "cancelled": return "#f87171";
    case "no_show": return "#fb923c";
    default: return "#fbbf24";
  }
};

const minutesFromMidnight = (isoStr: string): number => {
  const d = new Date(isoStr);
  return d.getHours() * 60 + d.getMinutes();
};

const getWeekDays = (weekStart: Date): Date[] =>
  Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + i);
    return d;
  });

const WeekView = ({
  bookings,
  practitioners,
  weekStart,
  selectedPractitionerIds,
  onBookingClick,
}: WeekViewProps) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [currentMinute, setCurrentMinute] = useState<number>(() => {
    const now = new Date();
    return now.getHours() * 60 + now.getMinutes();
  });

  useEffect(() => {
    const interval = setInterval(() => {
      const now = new Date();
      setCurrentMinute(now.getHours() * 60 + now.getMinutes());
    }, 60_000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (scrollRef.current) {
      const offset = (9 * 60 - HOUR_START * 60) * PX_PER_MINUTE;
      scrollRef.current.scrollTop = offset;
    }
  }, []);

  const weekDays = useMemo(() => getWeekDays(weekStart), [weekStart]);

  const todayStr = new Date().toDateString();

  const visiblePractitioners = useMemo(
    () =>
      practitioners.filter(
        (p) =>
          p.is_active &&
          (selectedPractitionerIds.length === 0 || selectedPractitionerIds.includes(p.id))
      ),
    [practitioners, selectedPractitionerIds]
  );

  const bookingsByDay = useMemo(() => {
    const map = new Map<string, BookingWithDetails[]>();
    for (const day of weekDays) {
      const key = day.toDateString();
      map.set(
        key,
        bookings.filter((b) => {
          const dayMatch = new Date(b.starts_at).toDateString() === key;
          const practMatch =
            selectedPractitionerIds.length === 0 ||
            selectedPractitionerIds.includes(b.practitioner_id);
          return dayMatch && practMatch;
        })
      );
    }
    return map;
  }, [bookings, weekDays, selectedPractitionerIds]);

  const currentLineTop =
    currentMinute >= HOUR_START * 60 && currentMinute <= HOUR_END * 60
      ? (currentMinute - HOUR_START * 60) * PX_PER_MINUTE
      : null;

  const todayColIndex = weekDays.findIndex((d) => d.toDateString() === todayStr);

  return (
    <div className="flex flex-col h-full">
      {/* Days header */}
      <div className="flex border-b bg-white sticky top-0 z-10">
        <div className="w-14 shrink-0 border-r" />
        {weekDays.map((day, idx) => {
          const isToday = day.toDateString() === todayStr;
          const isSunday = idx === 6;
          return (
            <div
              key={idx}
              className={`flex-1 px-2 py-2 text-center border-r last:border-r-0 ${
                isToday ? "bg-indigo-50" : ""
              } ${isSunday ? "bg-gray-50" : ""}`}
            >
              <div className="text-xs text-gray-500 uppercase tracking-wide">
                {DAY_LABELS[idx]}
              </div>
              <div
                className={`text-sm font-semibold mt-0.5 ${
                  isToday
                    ? "h-6 w-6 rounded-full bg-indigo-600 text-white flex items-center justify-center mx-auto"
                    : "text-gray-800"
                }`}
              >
                {day.getDate()}
              </div>
            </div>
          );
        })}
      </div>

      {/* Scrollable grid */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto">
        <div className="flex relative" style={{ height: TOTAL_MINUTES * PX_PER_MINUTE + 32 }}>
          {/* Time gutter */}
          <div className="w-14 shrink-0 border-r relative">
            {HOURS.map((hour) => (
              <div
                key={hour}
                className="absolute left-0 right-0 flex items-start justify-end pr-2"
                style={{ top: (hour - HOUR_START) * 60 * PX_PER_MINUTE - 8 }}
              >
                <span className="text-xs text-gray-400">{hour}:00</span>
              </div>
            ))}
          </div>

          {/* Day columns */}
          {weekDays.map((day, idx) => {
            const isToday = day.toDateString() === todayStr;
            const isSunday = idx === 6;
            const dayBookings = bookingsByDay.get(day.toDateString()) ?? [];

            return (
              <div
                key={idx}
                className={`flex-1 relative border-r last:border-r-0 ${
                  isToday ? "bg-indigo-50/30" : ""
                } ${isSunday ? "bg-gray-50/60" : ""}`}
              >
                {/* Hour lines */}
                {HOURS.map((hour) => (
                  <div
                    key={hour}
                    className="absolute left-0 right-0 border-t border-gray-100"
                    style={{ top: (hour - HOUR_START) * 60 * PX_PER_MINUTE }}
                  />
                ))}

                {/* Half-hour lines */}
                {HOURS.slice(0, -1).map((hour) => (
                  <div
                    key={`${hour}-30`}
                    className="absolute left-0 right-0 border-t border-dashed border-gray-50"
                    style={{ top: (hour - HOUR_START) * 60 * PX_PER_MINUTE + 30 }}
                  />
                ))}

                {/* Lunch break */}
                <div
                  className="absolute left-0 right-0 bg-gray-100/60 border-y border-gray-200/60"
                  style={{
                    top: (13 - HOUR_START) * 60 * PX_PER_MINUTE,
                    height: 60 * PX_PER_MINUTE,
                  }}
                />

                {/* Sunday closed overlay */}
                {isSunday && (
                  <div className="absolute inset-0 bg-gray-100/50 flex items-center justify-center pointer-events-none">
                    <span className="text-xs text-gray-400 font-medium rotate-[-90deg] whitespace-nowrap">
                      Fermé
                    </span>
                  </div>
                )}

                {/* Booking blocks */}
                {!isSunday &&
                  dayBookings.map((booking) => {
                    const startMin = minutesFromMidnight(booking.starts_at);
                    const endMin = minutesFromMidnight(booking.ends_at);
                    const top = (startMin - HOUR_START * 60) * PX_PER_MINUTE;
                    const height = Math.max((endMin - startMin) * PX_PER_MINUTE, 18);
                    const color =
                      booking.practitioner?.color ??
                      visiblePractitioners.find((p) => p.id === booking.practitioner_id)?.color ??
                      "#6366f1";
                    const borderColor = getStatusBorder(booking.status);

                    return (
                      <button
                        key={booking.id}
                        onClick={() => onBookingClick(booking)}
                        className="absolute left-0.5 right-0.5 rounded text-left overflow-hidden hover:brightness-95 transition-all px-1 py-0.5"
                        style={{
                          top,
                          height,
                          backgroundColor: `${color}25`,
                          borderLeft: `3px solid ${color}`,
                          outline: `1px solid ${borderColor}40`,
                        }}
                      >
                        <div className="flex items-center gap-0.5 text-[10px] font-medium text-gray-800 truncate">
                          {getChannelIcon(booking.source_channel)}
                          <span>{booking.client?.name ?? "?"}</span>
                        </div>
                        {height >= 32 && (
                          <div className="text-[10px] text-gray-500 truncate">
                            {booking.service?.name}
                          </div>
                        )}
                      </button>
                    );
                  })}

                {/* Current time line — only on today's column */}
                {isToday && currentLineTop !== null && (
                  <div
                    className="absolute left-0 right-0 flex items-center pointer-events-none z-20"
                    style={{ top: currentLineTop }}
                  >
                    {todayColIndex === idx && (
                      <div className="h-2 w-2 rounded-full bg-red-500 -ml-1 shrink-0" />
                    )}
                    <div className="flex-1 border-t-2 border-red-500" />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default WeekView;
