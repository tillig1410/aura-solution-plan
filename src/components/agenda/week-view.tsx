"use client";

import { useMemo, useRef, useEffect, useState } from "react";
import type { Practitioner, Booking } from "@/types/supabase";

interface BookingWithDetails extends Booking {
  client: { id: string; name: string | null; phone: string | null; preferred_language: string; notes: string | null; loyalty_tier: string; loyalty_points: number } | null;
  practitioner: { id: string; name: string; color: string } | null;
  service: { id: string; name: string; duration_minutes: number; price_cents: number } | null;
}

interface PractitionerWithAvailability extends Practitioner {
  availability?: { day_of_week: number | null; is_available: boolean; exception_date: string | null }[];
}

interface WeekViewProps {
  bookings: BookingWithDetails[];
  practitioners: PractitionerWithAvailability[];
  weekStart: Date;
  selectedPractitionerIds: string[];
  onBookingClick: (b: BookingWithDetails) => void;
}

const HOUR_START = 8;
const HOUR_END = 19;
const HOURS = Array.from({ length: HOUR_END - HOUR_START + 1 }, (_, i) => HOUR_START + i);
const TOTAL_MINUTES = (HOUR_END - HOUR_START) * 60;
const PADDING_TOP = 24;

const DAY_LABELS = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];


const minutesFromMidnight = (isoStr: string): number => {
  const d = new Date(isoStr);
  return d.getHours() * 60 + d.getMinutes();
};

/** Compute side-by-side column layout for overlapping bookings (Google Calendar style) */
const computeOverlapLayout = (dayBookings: BookingWithDetails[]): Map<string, { col: number; total: number }> => {
  if (dayBookings.length === 0) return new Map();

  const sorted = [...dayBookings].sort(
    (a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime()
  );

  // Group into clusters of overlapping bookings
  const clusters: BookingWithDetails[][] = [];
  let cluster: BookingWithDetails[] = [sorted[0]];
  let clusterEnd = minutesFromMidnight(sorted[0].ends_at);

  for (let i = 1; i < sorted.length; i++) {
    const startMin = minutesFromMidnight(sorted[i].starts_at);
    if (startMin < clusterEnd) {
      cluster.push(sorted[i]);
      clusterEnd = Math.max(clusterEnd, minutesFromMidnight(sorted[i].ends_at));
    } else {
      clusters.push(cluster);
      cluster = [sorted[i]];
      clusterEnd = minutesFromMidnight(sorted[i].ends_at);
    }
  }
  clusters.push(cluster);

  // Assign columns within each cluster
  const result = new Map<string, { col: number; total: number }>();

  for (const group of clusters) {
    const cols: number[] = []; // tracks end-time per column
    const assignments: { id: string; col: number }[] = [];

    for (const booking of group) {
      const start = minutesFromMidnight(booking.starts_at);
      const end = minutesFromMidnight(booking.ends_at);

      let placed = -1;
      for (let c = 0; c < cols.length; c++) {
        if (start >= cols[c]) {
          cols[c] = end;
          placed = c;
          break;
        }
      }
      if (placed === -1) {
        placed = cols.length;
        cols.push(end);
      }
      assignments.push({ id: booking.id, col: placed });
    }

    const total = cols.length;
    for (const a of assignments) {
      result.set(a.id, { col: a.col, total });
    }
  }

  return result;
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
      ? (currentMinute - HOUR_START * 60) * pxPerMinute + PADDING_TOP
      : null;

  const todayColIndex = weekDays.findIndex((d) => d.toDateString() === todayStr);

  return (
    <div className="flex flex-col h-full">
      {/* Days header */}
      <div className="flex border-b bg-white relative z-10">
        <div className="w-14 shrink-0 border-r" />
        {weekDays.map((day, idx) => {
          const isToday = day.toDateString() === todayStr;
          const isSunday = idx === 6;
          return (
            <div
              key={idx}
              className={`flex-1 px-2 py-2 text-center border-r last:border-r-0 ${
                isToday ? "bg-blue-50" : ""
              } ${isSunday ? "bg-slate-100" : ""}`}
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
              {/* Pastilles praticiens qui travaillent ce jour */}
              <div className="flex justify-center gap-0.5 mt-1">
                {practitioners.filter((p) => p.is_active).map((p) => {
                  const dayOfWeek = idx; // 0=Lun, 6=Dim
                  const avail = p.availability?.find(
                    (a) => a.day_of_week === dayOfWeek && a.exception_date === null
                  );
                  const works = avail ? avail.is_available : dayOfWeek < 6; // défaut: travaille lun-sam
                  return (
                    <div
                      key={p.id}
                      className={`h-2 w-2 rounded-full ${works ? "" : "opacity-20"}`}
                      style={{ backgroundColor: p.color }}
                      title={`${p.name}${works ? "" : " (absent)"}`}
                    />
                  );
                })}
              </div>
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

          {/* Day columns */}
          {weekDays.map((day, idx) => {
            const isToday = day.toDateString() === todayStr;
            const isSunday = idx === 6;
            const dayBookings = bookingsByDay.get(day.toDateString()) ?? [];

            return (
              <div
                key={idx}
                className={`flex-1 relative border-r last:border-r-0 ${
                  isToday ? "bg-blue-50/40" : ""
                }`}
              >
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
                {!isSunday && (
                  <div
                    className="absolute left-0 right-0 border-y border-amber-200/60"
                    style={{
                      top: (13 - HOUR_START) * 60 * pxPerMinute + PADDING_TOP,
                      height: 60 * pxPerMinute,
                      background: "repeating-linear-gradient(45deg, transparent, transparent 4px, rgba(251,191,36,0.08) 4px, rgba(251,191,36,0.08) 8px)",
                    }}
                  />
                )}

                {/* Sunday closed overlay */}
                {isSunday && (
                  <div
                    className="absolute inset-0 flex items-center justify-center pointer-events-none"
                    style={{
                      background: "repeating-linear-gradient(-45deg, transparent, transparent 5px, rgba(148,163,184,0.15) 5px, rgba(148,163,184,0.15) 10px)",
                    }}
                  >
                    <span className="text-sm text-gray-400 font-medium">
                      Fermé
                    </span>
                  </div>
                )}

                {/* Booking blocks — overlap layout */}
                {!isSunday &&
                  (() => {
                    const layout = computeOverlapLayout(dayBookings);
                    return dayBookings.map((booking) => {
                      const startMin = minutesFromMidnight(booking.starts_at);
                      const endMin = minutesFromMidnight(booking.ends_at);
                      const top = (startMin - HOUR_START * 60) * pxPerMinute + PADDING_TOP;
                      const height = Math.max((endMin - startMin) * pxPerMinute, 28);
                      const color =
                        booking.practitioner?.color ??
                        visiblePractitioners.find((p) => p.id === booking.practitioner_id)?.color ??
                        "#6366f1";
                      const timeStart = new Date(booking.starts_at).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
                      const timeEnd = new Date(booking.ends_at).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
                      const pos = layout.get(booking.id) ?? { col: 0, total: 1 };
                      const widthPct = 100 / pos.total;
                      const leftPct = pos.col * widthPct;

                      return (
                        <div
                          key={booking.id}
                          className="absolute group/tip"
                          style={{
                            top,
                            height,
                            left: `calc(${leftPct}% + 2px)`,
                            width: `calc(${widthPct}% - 4px)`,
                          }}
                        >
                          <button
                            onClick={() => onBookingClick(booking)}
                            className="w-full h-full rounded-lg text-left overflow-hidden hover:brightness-90 transition-all px-1 py-0.5"
                            style={{
                              backgroundColor: `${color}20`,
                              borderLeft: `3px solid ${color}`,
                              boxShadow: "0 1px 3px rgba(0,0,0,0.10)",
                            }}
                          >
                            <div className="flex items-center gap-1">
                              <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${booking.status === "pending" ? "bg-amber-500" : "bg-green-500"}`} />
                              <span className="text-[9px] font-semibold truncate" style={{ color }}>
                                {timeStart}
                              </span>
                            </div>
                            {height >= 30 && (
                              <div className="text-[10px] font-bold text-gray-900 truncate leading-tight">
                                {booking.service?.name}
                              </div>
                            )}
                          </button>
                          {/* Custom tooltip */}
                          <div className="hidden group-hover/tip:block absolute left-0 top-full mt-1 z-30 pointer-events-none">
                            <div className="rounded-xl bg-white shadow-lg ring-1 ring-black/10 px-3 py-2.5 min-w-[160px] max-w-[220px]">
                              <div className="text-xs font-bold text-gray-900">{booking.client?.name ?? "Client inconnu"}</div>
                              <div className="text-[11px] text-gray-600 mt-0.5">{booking.service?.name}</div>
                              <div className="text-[11px] font-semibold mt-1" style={{ color }}>{timeStart} — {timeEnd}</div>
                              {booking.practitioner && (
                                <div className="mt-1.5 flex items-center gap-1.5">
                                  <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: color }} />
                                  <span className="text-[11px] font-medium" style={{ color }}>{booking.practitioner.name}</span>
                                </div>
                              )}
                              <div className="mt-1.5 flex items-center gap-1.5">
                                <span className={`w-2 h-2 rounded-full shrink-0 ${booking.status === "pending" ? "bg-amber-500" : "bg-green-500"}`} />
                                <span className={`text-[10px] font-semibold ${booking.status === "pending" ? "text-amber-600" : "text-green-600"}`}>
                                  {booking.status === "pending" ? "À confirmer" : "Confirmé"}
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    });
                  })()}

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
