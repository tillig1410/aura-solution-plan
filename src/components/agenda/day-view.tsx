"use client";

import { useMemo, useRef, useEffect, useState } from "react";
import { Sparkles } from "lucide-react";
import type { Practitioner, Booking } from "@/types/supabase";

interface BookingWithDetails extends Booking {
  client: { id: string; name: string | null; phone: string | null; preferred_language: string; notes: string | null; loyalty_tier: string; loyalty_points: number } | null;
  practitioner: { id: string; name: string; color: string } | null;
  service: { id: string; name: string; duration_minutes: number; price_cents: number } | null;
}

interface PractitionerWithAvailability extends Practitioner {
  availability?: { day_of_week: number | null; start_time: string; end_time: string; is_available: boolean; exception_date: string | null; break_start: string | null; break_end: string | null }[];
}

interface DayViewProps {
  bookings: BookingWithDetails[];
  practitioners: PractitionerWithAvailability[];
  date: Date;
  onBookingClick: (b: BookingWithDetails) => void;
  newClientIds?: Set<string>;
}

const HOUR_START = 8;
const HOUR_END = 19;
const TOTAL_MINUTES = (HOUR_END - HOUR_START) * 60;
const PADDING_TOP = 24;

const HOURS = Array.from({ length: HOUR_END - HOUR_START + 1 }, (_, i) => HOUR_START + i);


const minutesFromMidnight = (isoStr: string): number => {
  const d = new Date(isoStr);
  return d.getHours() * 60 + d.getMinutes();
};

const DayView = ({ bookings, practitioners, date, onBookingClick, newClientIds }: DayViewProps) => {
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
      setPxPerMinute(Math.max(1.5, available / TOTAL_MINUTES));
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
        {activePractitioners.map((p) => {
          const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
          const onVacation = p.availability?.some((a) => a.exception_date === dateStr && !a.is_available) ?? false;
          return (
            <div
              key={p.id}
              className={`flex-1 flex items-center gap-2 px-3 py-2 border-r last:border-r-0 ${onVacation ? "opacity-40" : ""}`}
            >
              <span
                className="h-3 w-3 rounded-full shrink-0"
                style={{ backgroundColor: p.color }}
              />
              <span className="text-sm font-medium text-gray-700 truncate">
                {p.name}{onVacation ? " (congé)" : ""}
              </span>
            </div>
          );
        })}
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
            const dayOfWeek = (date.getDay() + 6) % 7;
            const pracDayAvail = p.availability?.find(
              (a) => a.day_of_week === dayOfWeek && a.exception_date === null
            );
            const pracStart = pracDayAvail ? parseInt(pracDayAvail.start_time.slice(0, 2)) * 60 + parseInt(pracDayAvail.start_time.slice(3, 5)) : HOUR_START * 60;
            const pracEnd = pracDayAvail ? parseInt(pracDayAvail.end_time.slice(0, 2)) * 60 + parseInt(pracDayAvail.end_time.slice(3, 5)) : HOUR_END * 60;

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

                {/* Closed hours overlay — before opening */}
                {pracStart > HOUR_START * 60 && (
                  <div
                    className="absolute left-0 right-0 pointer-events-none"
                    style={{
                      top: PADDING_TOP,
                      height: (pracStart - HOUR_START * 60) * pxPerMinute,
                      background: "repeating-linear-gradient(-45deg, transparent, transparent 5px, rgba(148,163,184,0.08) 5px, rgba(148,163,184,0.08) 10px)",
                    }}
                  />
                )}

                {/* Closed hours overlay — after closing */}
                {pracEnd < HOUR_END * 60 && (
                  <div
                    className="absolute left-0 right-0 pointer-events-none"
                    style={{
                      top: (pracEnd - HOUR_START * 60) * pxPerMinute + PADDING_TOP,
                      height: (HOUR_END * 60 - pracEnd) * pxPerMinute,
                      background: "repeating-linear-gradient(-45deg, transparent, transparent 5px, rgba(148,163,184,0.08) 5px, rgba(148,163,184,0.08) 10px)",
                    }}
                  />
                )}

                {/* Lunch break — dynamic per practitioner */}
                {(() => {
                  const dayOfWeek = (date.getDay() + 6) % 7;
                  const dayAvail = p.availability?.find(
                    (a) => a.day_of_week === dayOfWeek && a.exception_date === null
                  );
                  const bs = dayAvail?.break_start?.slice(0, 5) ?? "12:00";
                  const be = dayAvail?.break_end?.slice(0, 5) ?? "13:00";
                  const [bsH, bsM] = bs.split(":").map(Number);
                  const [beH, beM] = be.split(":").map(Number);
                  const breakStartMins = bsH * 60 + bsM;
                  const breakEndMins = beH * 60 + beM;
                  if (breakStartMins >= breakEndMins) return null;
                  return (
                    <div
                      className="absolute left-0 right-0 border-y border-amber-200/60 flex items-center justify-center"
                      style={{
                        top: (breakStartMins - HOUR_START * 60) * pxPerMinute + PADDING_TOP,
                        height: (breakEndMins - breakStartMins) * pxPerMinute,
                        background: "repeating-linear-gradient(45deg, transparent, transparent 4px, rgba(251,191,36,0.08) 4px, rgba(251,191,36,0.08) 8px)",
                      }}
                    >
                      <span className="text-xs text-amber-400">Pause</span>
                    </div>
                  );
                })()}

                {/* Booking blocks */}
                {colBookings.map((booking) => {
                  const startMin = minutesFromMidnight(booking.starts_at);
                  const endMin = minutesFromMidnight(booking.ends_at);
                  const top = (startMin - HOUR_START * 60) * pxPerMinute + PADDING_TOP;
                  const height = Math.max((endMin - startMin) * pxPerMinute, 28);
                  const color = booking.practitioner?.color ?? p.color;
                  const isNoShow = booking.status === "no_show";
                  const isCancelled = booking.status === "cancelled";
                  const timeStart = new Date(booking.starts_at).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
                  const timeEnd = new Date(booking.ends_at).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });

                  return (
                    <div
                      key={booking.id}
                      className={`absolute left-1.5 right-1.5 group/tip ${isNoShow || isCancelled ? "opacity-40 grayscale" : ""}`}
                      style={{ top, height }}
                    >
                      <button
                        onClick={() => onBookingClick(booking)}
                        className="w-full h-full rounded-xl px-2.5 py-1.5 text-left overflow-hidden hover:brightness-95 transition-all relative"
                        style={{
                          backgroundColor: `${isNoShow || isCancelled ? "#9ca3af" : color}15`,
                          borderLeft: `4px solid ${isNoShow || isCancelled ? "#9ca3af" : color}`,
                          boxShadow: "0 1px 4px rgba(0,0,0,0.08)",
                        }}
                      >
                        {booking.client && newClientIds?.has(booking.client.id) && !isCancelled && !isNoShow && (
                          <span className="absolute top-1 right-1 inline-flex items-center gap-0.5 text-[9px] font-bold bg-emerald-500 text-white rounded-full px-1.5 py-0.5 shadow-sm">
                            <Sparkles className="w-2.5 h-2.5" />
                            Nouveau
                          </span>
                        )}
                        <div className="flex items-center gap-1.5">
                          <span className={`w-2 h-2 rounded-full shrink-0 ${booking.status === "pending" ? "bg-amber-500" : "bg-green-500"}`} />
                          <span className="text-[11px] font-semibold truncate" style={{ color }}>
                            {timeStart} — {timeEnd}
                          </span>
                        </div>
                        {height >= 40 && (
                          <div className="text-sm font-bold text-gray-900 truncate leading-tight mt-0.5">
                            {booking.service?.name}
                          </div>
                        )}
                      </button>
                      {/* Custom tooltip */}
                      <div className="hidden group-hover/tip:block absolute left-0 top-full mt-1 z-30 pointer-events-none">
                        <div className="rounded-xl bg-white shadow-lg ring-1 ring-black/10 px-3 py-2.5 min-w-[180px] max-w-[240px]">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-xs font-bold text-gray-900">{booking.client?.name ?? "Client inconnu"}</span>
                            {booking.client && newClientIds?.has(booking.client.id) && (
                              <span className="inline-flex items-center gap-0.5 text-[9px] font-bold bg-emerald-100 text-emerald-700 rounded-full px-1.5 py-0.5 border border-emerald-200">
                                <Sparkles className="w-2.5 h-2.5" />
                                Nouveau client
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-gray-600 mt-0.5">{booking.service?.name}</div>
                          <div className="text-[11px] font-semibold mt-1" style={{ color }}>{timeStart} — {timeEnd}</div>
                          <div className="mt-1.5 flex items-center gap-2 flex-wrap">
                            {booking.practitioner && (
                              <span
                                className="text-[10px] font-medium text-white rounded-full px-1.5 py-0.5 inline-flex items-center gap-1"
                                style={{ backgroundColor: color }}
                              >
                                <span className="w-1.5 h-1.5 rounded-full bg-white/60" />
                                {booking.practitioner.name}
                              </span>
                            )}
                            <span className={`text-[10px] font-semibold rounded-full px-1.5 py-0.5 ${booking.status === "pending" ? "bg-amber-100 text-amber-700" : "bg-green-100 text-green-700"}`}>
                              {booking.status === "pending" ? "À confirmer" : "Confirmé"}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
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
