"use client";

import { useMemo, useRef, useEffect, useState } from "react";
import { MessageSquare, Phone, Monitor } from "lucide-react";
import type { Practitioner, Booking } from "@/types/supabase";

interface BookingWithDetails extends Booking {
  client: { id: string; name: string | null; phone: string | null; preferred_language: string } | null;
  practitioner: { id: string; name: string; color: string } | null;
  service: { id: string; name: string; duration_minutes: number; price_cents: number } | null;
}

interface DayViewProps {
  bookings: BookingWithDetails[];
  practitioners: Practitioner[];
  date: Date;
  onBookingClick: (b: BookingWithDetails) => void;
}

const HOUR_START = 8;
const HOUR_END = 19;
const TOTAL_MINUTES = (HOUR_END - HOUR_START) * 60;
const PADDING_TOP = 24;

const HOURS = Array.from({ length: HOUR_END - HOUR_START + 1 }, (_, i) => HOUR_START + i);

const getChannelIcon = (channel: Booking["source_channel"]) => {
  if (channel === "voice") return <Phone className="h-3 w-3" />;
  if (channel === "dashboard" || channel === "booking_page") return <Monitor className="h-3 w-3" />;
  return <MessageSquare className="h-3 w-3" />;
};

const getStatusRingColor = (status: Booking["status"]): string => {
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

const DayView = ({ bookings, practitioners, date, onBookingClick }: DayViewProps) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [pxPerMinute, setPxPerMinute] = useState(1);
  const [currentMinute, setCurrentMinute] = useState<number>(() => {
    const now = new Date();
    return now.getHours() * 60 + now.getMinutes();
  });

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const update = () => {
      const available = el.clientHeight - PADDING_TOP;
      setPxPerMinute(Math.max(1, available / TOTAL_MINUTES));
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      const now = new Date();
      setCurrentMinute(now.getHours() * 60 + now.getMinutes());
    }, 60_000);
    return () => clearInterval(interval);
  }, []);

  const isToday = useMemo(() => {
    const now = new Date();
    return (
      date.getFullYear() === now.getFullYear() &&
      date.getMonth() === now.getMonth() &&
      date.getDate() === now.getDate()
    );
  }, [date]);

  const currentLineTop =
    isToday && currentMinute >= HOUR_START * 60 && currentMinute <= HOUR_END * 60
      ? (currentMinute - HOUR_START * 60) * pxPerMinute + PADDING_TOP
      : null;

  const dayBookings = useMemo(() => {
    const dayStr = date.toDateString();
    return bookings.filter((b) => new Date(b.starts_at).toDateString() === dayStr);
  }, [bookings, date]);

  const activePractitioners = useMemo(
    () => practitioners.filter((p) => p.is_active),
    [practitioners]
  );

  return (
    <div className="flex flex-col h-full">
      {/* Practitioners header */}
      <div className="flex border-b bg-white relative z-10">
        <div className="w-14 shrink-0 border-r" />
        {activePractitioners.map((p) => (
          <div
            key={p.id}
            className="flex-1 flex items-center gap-2 px-3 py-2 border-r last:border-r-0"
          >
            <span
              className="h-3 w-3 rounded-full shrink-0"
              style={{ backgroundColor: p.color }}
            />
            <span className="text-sm font-medium text-gray-700 truncate">{p.name}</span>
          </div>
        ))}
      </div>

      {/* Scrollable grid */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto">
        <div className="flex relative" style={{ height: TOTAL_MINUTES * pxPerMinute + PADDING_TOP }}>
          {/* Time gutter */}
          <div className="w-14 shrink-0 border-r relative">
            {HOURS.map((hour) => (
              <div
                key={hour}
                className="absolute left-0 right-0 flex items-start justify-end pr-2"
                style={{ top: (hour - HOUR_START) * 60 * pxPerMinute + PADDING_TOP - 8 }}
              >
                <span className="text-xs text-gray-400">{hour}:00</span>
              </div>
            ))}
          </div>

          {/* Practitioner columns */}
          {activePractitioners.map((p) => {
            const colBookings = dayBookings.filter((b) => b.practitioner_id === p.id);

            return (
              <div key={p.id} className="flex-1 relative border-r last:border-r-0">
                {/* Hour lines */}
                {HOURS.map((hour) => (
                  <div
                    key={hour}
                    className="absolute left-0 right-0 border-t border-gray-100"
                    style={{ top: (hour - HOUR_START) * 60 * pxPerMinute + PADDING_TOP }}
                  />
                ))}

                {/* Half-hour lines */}
                {HOURS.slice(0, -1).map((hour) => (
                  <div
                    key={`${hour}-30`}
                    className="absolute left-0 right-0 border-t border-dashed border-gray-50"
                    style={{ top: (hour - HOUR_START) * 60 * pxPerMinute + 30 * pxPerMinute + PADDING_TOP }}
                  />
                ))}

                {/* Lunch break */}
                <div
                  className="absolute left-0 right-0 bg-gray-50 border-y border-gray-200 flex items-center justify-center"
                  style={{
                    top: (13 - HOUR_START) * 60 * pxPerMinute + PADDING_TOP,
                    height: 60 * pxPerMinute,
                  }}
                >
                  <span className="text-xs text-gray-400">Pause déjeuner</span>
                </div>

                {/* Booking blocks */}
                {colBookings.map((booking) => {
                  const startMin = minutesFromMidnight(booking.starts_at);
                  const endMin = minutesFromMidnight(booking.ends_at);
                  const top = (startMin - HOUR_START * 60) * pxPerMinute + PADDING_TOP;
                  const height = Math.max((endMin - startMin) * pxPerMinute, 20);
                  const color = booking.practitioner?.color ?? p.color;
                  const statusColor = getStatusRingColor(booking.status);

                  return (
                    <button
                      key={booking.id}
                      onClick={() => onBookingClick(booking)}
                      className="absolute left-1 right-1 rounded-md px-2 py-1 text-left overflow-hidden hover:brightness-95 transition-all"
                      style={{
                        top,
                        height,
                        backgroundColor: `${color}22`,
                        borderLeft: `3px solid ${color}`,
                        outline: `2px solid ${statusColor}50`,
                      }}
                    >
                      <div className="flex items-center gap-1 text-xs font-medium text-gray-800 truncate">
                        {getChannelIcon(booking.source_channel)}
                        <span>{booking.client?.name ?? "Client inconnu"}</span>
                      </div>
                      {height >= 36 && (
                        <div className="text-xs text-gray-500 truncate">
                          {booking.service?.name}
                        </div>
                      )}
                      {height >= 50 && (
                        <div className="text-xs text-gray-400">
                          {new Date(booking.starts_at).toLocaleTimeString("fr-FR", {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                          {" — "}
                          {new Date(booking.ends_at).toLocaleTimeString("fr-FR", {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            );
          })}

          {/* Current time line */}
          {currentLineTop !== null && (
            <div
              className="absolute left-14 right-0 flex items-center pointer-events-none z-20"
              style={{ top: currentLineTop }}
            >
              <div className="h-2 w-2 rounded-full bg-red-500 -ml-1" />
              <div className="flex-1 border-t-2 border-red-500" />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default DayView;
