"use client";

import { useState, useCallback, useMemo } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  Bell,
  CalendarDays,
  MessageSquare,
  Phone,
  Monitor,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import DayView from "@/components/agenda/day-view";
import WeekView from "@/components/agenda/week-view";
import MonthView from "@/components/agenda/month-view";
import BookingForm from "@/components/agenda/booking-form";
import type { Booking, Practitioner, Service, Client } from "@/types/supabase";

type ViewMode = "day" | "week" | "month";

interface BookingWithDetails extends Booking {
  client: { id: string; name: string | null; phone: string | null; preferred_language: string } | null;
  practitioner: { id: string; name: string; color: string } | null;
  service: { id: string; name: string; duration_minutes: number; price_cents: number } | null;
}

interface CreateBookingData {
  client_id: string;
  practitioner_id: string;
  service_id: string;
  starts_at: string;
  ends_at: string;
  source_channel: "dashboard";
}

// ---------- helpers ----------

const getMonday = (date: Date): Date => {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
};

const formatDateLabel = (date: Date, view: ViewMode): string => {
  if (view === "day") {
    return date.toLocaleDateString("fr-FR", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  }
  if (view === "week") {
    const monday = getMonday(date);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    const from = monday.toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
    const to = sunday.toLocaleDateString("fr-FR", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
    return `${from} — ${to}`;
  }
  return date.toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
};

const navigateDate = (date: Date, view: ViewMode, direction: -1 | 1): Date => {
  const d = new Date(date);
  if (view === "day") d.setDate(d.getDate() + direction);
  else if (view === "week") d.setDate(d.getDate() + direction * 7);
  else d.setMonth(d.getMonth() + direction);
  return d;
};

const getChannelIcon = (channel: Booking["source_channel"]) => {
  if (channel === "voice") return <Phone className="h-3.5 w-3.5" />;
  if (channel === "dashboard" || channel === "booking_page") return <Monitor className="h-3.5 w-3.5" />;
  return <MessageSquare className="h-3.5 w-3.5" />;
};

const statusLabel: Record<Booking["status"], string> = {
  pending: "En attente",
  confirmed: "Confirmé",
  in_progress: "En cours",
  completed: "Terminé",
  cancelled: "Annulé",
  no_show: "Absent",
};

const statusColor: Record<Booking["status"], string> = {
  pending: "bg-yellow-100 text-yellow-700",
  confirmed: "bg-green-100 text-green-700",
  in_progress: "bg-blue-100 text-blue-700",
  completed: "bg-gray-100 text-gray-600",
  cancelled: "bg-red-100 text-red-600",
  no_show: "bg-orange-100 text-orange-600",
};

// ---------- mock data (to be replaced with real fetches) ----------
const MOCK_PRACTITIONERS: Practitioner[] = [
  {
    id: "p1",
    merchant_id: "m1",
    name: "Alice",
    email: null,
    color: "#6366f1",
    specialties: [],
    is_active: true,
    sort_order: 0,
    created_at: "",
    updated_at: "",
  },
  {
    id: "p2",
    merchant_id: "m1",
    name: "Bob",
    email: null,
    color: "#ec4899",
    specialties: [],
    is_active: true,
    sort_order: 1,
    created_at: "",
    updated_at: "",
  },
];

const MOCK_SERVICES: Service[] = [
  {
    id: "s1",
    merchant_id: "m1",
    name: "Coupe homme",
    description: null,
    duration_minutes: 30,
    price_cents: 2500,
    is_active: true,
    sort_order: 0,
    created_at: "",
    updated_at: "",
  },
  {
    id: "s2",
    merchant_id: "m1",
    name: "Coloration",
    description: null,
    duration_minutes: 90,
    price_cents: 7500,
    is_active: true,
    sort_order: 1,
    created_at: "",
    updated_at: "",
  },
];

const MOCK_CLIENTS: Client[] = [
  {
    id: "c1",
    merchant_id: "m1",
    name: "Jean Dupont",
    phone: "0601020304",
    email: null,
    whatsapp_id: null,
    messenger_id: null,
    telegram_id: null,
    preferred_practitioner_id: null,
    preferred_service_id: null,
    preferred_language: "fr",
    loyalty_points: 0,
    loyalty_tier: "bronze",
    no_show_count: 0,
    is_blocked: false,
    notes: null,
    created_at: "",
    updated_at: "",
  },
];

const buildMockBookings = (): BookingWithDetails[] => {
  const now = new Date();
  const today9h = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 9, 0);
  const today11h = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 11, 0);
  return [
    {
      id: "b1",
      merchant_id: "m1",
      client_id: "c1",
      practitioner_id: "p1",
      service_id: "s1",
      starts_at: today9h.toISOString(),
      ends_at: new Date(today9h.getTime() + 30 * 60000).toISOString(),
      status: "confirmed",
      source_channel: "whatsapp",
      cancelled_at: null,
      cancelled_by: null,
      version: 1,
      created_at: "",
      updated_at: "",
      client: { id: "c1", name: "Jean Dupont", phone: "0601020304", preferred_language: "fr" },
      practitioner: { id: "p1", name: "Alice", color: "#6366f1" },
      service: { id: "s1", name: "Coupe homme", duration_minutes: 30, price_cents: 2500 },
    },
    {
      id: "b2",
      merchant_id: "m1",
      client_id: "c1",
      practitioner_id: "p2",
      service_id: "s2",
      starts_at: today11h.toISOString(),
      ends_at: new Date(today11h.getTime() + 90 * 60000).toISOString(),
      status: "pending",
      source_channel: "dashboard",
      cancelled_at: null,
      cancelled_by: null,
      version: 1,
      created_at: "",
      updated_at: "",
      client: { id: "c1", name: "Jean Dupont", phone: "0601020304", preferred_language: "fr" },
      practitioner: { id: "p2", name: "Bob", color: "#ec4899" },
      service: { id: "s2", name: "Coloration", duration_minutes: 90, price_cents: 7500 },
    },
  ];
};

// ---------- component ----------

const AgendaContent = () => {
  const [view, setView] = useState<ViewMode>("week");
  const [currentDate, setCurrentDate] = useState<Date>(() => new Date());
  const [selectedPractitionerIds, setSelectedPractitionerIds] = useState<string[]>([]);
  const [bookings, setBookings] = useState<BookingWithDetails[]>(() => buildMockBookings());
  const [selectedBooking, setSelectedBooking] = useState<BookingWithDetails | null>(null);
  const [formOpen, setFormOpen] = useState(false);

  const practitioners = MOCK_PRACTITIONERS;
  const services = MOCK_SERVICES;
  const clients = MOCK_CLIENTS;

  const weekStart = useMemo(() => getMonday(currentDate), [currentDate]);

  // Today's bookings for the summary panel
  const todayStr = new Date().toDateString();
  const todayBookings = useMemo(
    () => bookings.filter((b) => new Date(b.starts_at).toDateString() === todayStr),
    [bookings, todayStr]
  );

  const upcomingBookings = useMemo(() => {
    const now = new Date();
    return todayBookings
      .filter(
        (b) =>
          new Date(b.starts_at) >= now &&
          b.status !== "cancelled" &&
          b.status !== "no_show"
      )
      .sort((a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime())
      .slice(0, 5);
  }, [todayBookings]);

  const channelCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const b of todayBookings) {
      counts[b.source_channel] = (counts[b.source_channel] ?? 0) + 1;
    }
    return counts;
  }, [todayBookings]);

  // Navigation
  const goToToday = useCallback(() => setCurrentDate(new Date()), []);
  const goBack = useCallback(() => setCurrentDate((d) => navigateDate(d, view, -1)), [view]);
  const goForward = useCallback(() => setCurrentDate((d) => navigateDate(d, view, 1)), [view]);

  // Practitioner filter toggle
  const togglePractitioner = useCallback((id: string) => {
    setSelectedPractitionerIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }, []);

  // Booking handlers
  const handleBookingClick = useCallback((b: BookingWithDetails) => {
    setSelectedBooking(b);
    setFormOpen(true);
  }, []);

  const handleDayClick = useCallback((d: Date) => {
    setCurrentDate(d);
    setView("day");
  }, []);

  const handleFormSubmit = useCallback(
    (data: CreateBookingData) => {
      if (selectedBooking) {
        // Edit mode — update in-memory
        setBookings((prev) =>
          prev.map((b) =>
            b.id === selectedBooking.id
              ? {
                  ...b,
                  ...data,
                  client:
                    clients.find((c) => c.id === data.client_id)
                      ? {
                          id: data.client_id,
                          name: clients.find((c) => c.id === data.client_id)?.name ?? null,
                          phone: clients.find((c) => c.id === data.client_id)?.phone ?? null,
                          preferred_language:
                            clients.find((c) => c.id === data.client_id)?.preferred_language ??
                            "fr",
                        }
                      : b.client,
                  practitioner:
                    practitioners.find((p) => p.id === data.practitioner_id)
                      ? {
                          id: data.practitioner_id,
                          name:
                            practitioners.find((p) => p.id === data.practitioner_id)?.name ?? "",
                          color:
                            practitioners.find((p) => p.id === data.practitioner_id)?.color ??
                            "#6366f1",
                        }
                      : b.practitioner,
                  service:
                    services.find((s) => s.id === data.service_id)
                      ? {
                          id: data.service_id,
                          name: services.find((s) => s.id === data.service_id)?.name ?? "",
                          duration_minutes:
                            services.find((s) => s.id === data.service_id)?.duration_minutes ?? 60,
                          price_cents:
                            services.find((s) => s.id === data.service_id)?.price_cents ?? 0,
                        }
                      : b.service,
                }
              : b
          )
        );
      } else {
        // Create mode
        const clientObj = clients.find((c) => c.id === data.client_id);
        const practObj = practitioners.find((p) => p.id === data.practitioner_id);
        const svcObj = services.find((s) => s.id === data.service_id);
        const newBooking: BookingWithDetails = {
          id: `b-${Date.now()}`,
          merchant_id: "m1",
          ...data,
          status: "pending",
          cancelled_at: null,
          cancelled_by: null,
          version: 1,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          client: clientObj
            ? {
                id: clientObj.id,
                name: clientObj.name,
                phone: clientObj.phone,
                preferred_language: clientObj.preferred_language,
              }
            : null,
          practitioner: practObj
            ? { id: practObj.id, name: practObj.name, color: practObj.color }
            : null,
          service: svcObj
            ? {
                id: svcObj.id,
                name: svcObj.name,
                duration_minutes: svcObj.duration_minutes,
                price_cents: svcObj.price_cents,
              }
            : null,
        };
        setBookings((prev) => [...prev, newBooking]);
      }
      setFormOpen(false);
      setSelectedBooking(null);
    },
    [selectedBooking, clients, practitioners, services]
  );

  const handleFormClose = useCallback(() => {
    setFormOpen(false);
    setSelectedBooking(null);
  }, []);

  return (
    <div className="flex h-full gap-4">
      {/* Main calendar area */}
      <div className="flex flex-1 flex-col gap-3 min-w-0">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Agenda</h1>
            <p className="text-sm text-gray-500">
              {new Date().toLocaleDateString("fr-FR", {
                weekday: "long",
                day: "numeric",
                month: "long",
                year: "numeric",
              })}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              aria-label="Notifications"
            >
              <Bell className="h-5 w-5" />
            </Button>
            <Button onClick={() => { setSelectedBooking(null); setFormOpen(true); }}>
              <Plus className="h-4 w-4" />
              Nouveau RDV
            </Button>
          </div>
        </div>

        {/* Toolbar */}
        <div className="flex flex-wrap items-center gap-3 rounded-xl bg-white px-4 py-2 ring-1 ring-foreground/10">
          {/* View selector */}
          <div className="flex rounded-lg overflow-hidden border border-input">
            {(["day", "week", "month"] as ViewMode[]).map((v) => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={`px-3 py-1.5 text-sm font-medium transition-colors capitalize ${
                  view === v
                    ? "bg-indigo-600 text-white"
                    : "text-gray-600 hover:bg-gray-50"
                }`}
              >
                {v === "day" ? "Jour" : v === "week" ? "Semaine" : "Mois"}
              </button>
            ))}
          </div>

          {/* Navigation */}
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" onClick={goBack} aria-label="Précédent">
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm font-medium text-gray-700 min-w-[180px] text-center">
              {formatDateLabel(currentDate, view)}
            </span>
            <Button variant="ghost" size="icon" onClick={goForward} aria-label="Suivant">
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          <Button variant="outline" size="sm" onClick={goToToday}>
            Aujourd&apos;hui
          </Button>

          {/* Practitioner filters */}
          <div className="flex items-center gap-2 ml-auto flex-wrap">
            {practitioners.map((p) => {
              const active =
                selectedPractitionerIds.length === 0 ||
                selectedPractitionerIds.includes(p.id);
              return (
                <button
                  key={p.id}
                  onClick={() => togglePractitioner(p.id)}
                  className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium border transition-all ${
                    active
                      ? "border-transparent text-white"
                      : "border-gray-200 text-gray-400 bg-white"
                  }`}
                  style={active ? { backgroundColor: p.color } : {}}
                >
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{ backgroundColor: active ? "white" : p.color }}
                  />
                  {p.name}
                </button>
              );
            })}
          </div>
        </div>

        {/* Calendar view */}
        <div className="flex-1 rounded-xl overflow-hidden ring-1 ring-foreground/10 bg-white min-h-0">
          {view === "day" && (
            <DayView
              bookings={bookings}
              practitioners={practitioners}
              date={currentDate}
              onBookingClick={handleBookingClick}
            />
          )}
          {view === "week" && (
            <WeekView
              bookings={bookings}
              practitioners={practitioners}
              weekStart={weekStart}
              selectedPractitionerIds={selectedPractitionerIds}
              onBookingClick={handleBookingClick}
            />
          )}
          {view === "month" && (
            <MonthView
              bookings={bookings}
              practitioners={practitioners}
              month={currentDate}
              onDayClick={handleDayClick}
            />
          )}
        </div>
      </div>

      {/* Summary panel */}
      <aside className="w-72 shrink-0 flex flex-col gap-3">
        {/* Stats du jour */}
        <Card size="sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm">
              <CalendarDays className="h-4 w-4 text-indigo-600" />
              Résumé du jour
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-lg bg-indigo-50 px-3 py-2 text-center">
                <div className="text-2xl font-bold text-indigo-700">{todayBookings.length}</div>
                <div className="text-xs text-indigo-500">RDV total</div>
              </div>
              <div className="rounded-lg bg-green-50 px-3 py-2 text-center">
                <div className="text-2xl font-bold text-green-700">
                  {todayBookings.filter((b) => b.status === "confirmed").length}
                </div>
                <div className="text-xs text-green-500">Confirmés</div>
              </div>
            </div>

            {/* Canaux */}
            {Object.keys(channelCounts).length > 0 && (
              <div>
                <div className="text-xs font-medium text-gray-500 mb-1.5">Par canal</div>
                <div className="flex flex-col gap-1">
                  {(Object.entries(channelCounts) as [Booking["source_channel"], number][]).map(
                    ([channel, count]) => (
                      <div key={channel} className="flex items-center gap-2 text-xs text-gray-600">
                        {getChannelIcon(channel)}
                        <span className="capitalize flex-1">{channel}</span>
                        <span className="font-medium">{count}</span>
                      </div>
                    )
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* RDV à venir */}
        <Card size="sm" className="flex-1 overflow-hidden">
          <CardHeader>
            <CardTitle className="text-sm">Prochains RDV</CardTitle>
          </CardHeader>
          <CardContent className="overflow-y-auto flex flex-col gap-2 max-h-96">
            {upcomingBookings.length === 0 ? (
              <p className="text-xs text-muted-foreground">Aucun RDV à venir aujourd&apos;hui.</p>
            ) : (
              upcomingBookings.map((b) => (
                <button
                  key={b.id}
                  onClick={() => handleBookingClick(b)}
                  className="w-full text-left rounded-lg border border-gray-100 p-2.5 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <span className="text-xs font-medium text-gray-800 truncate">
                      {b.client?.name ?? "Client inconnu"}
                    </span>
                    <span
                      className={`text-[10px] font-medium rounded-full px-1.5 py-0.5 shrink-0 ${statusColor[b.status]}`}
                    >
                      {statusLabel[b.status]}
                    </span>
                  </div>
                  <div className="text-xs text-gray-500 flex items-center gap-2">
                    <span>
                      {new Date(b.starts_at).toLocaleTimeString("fr-FR", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                    <span className="text-gray-300">·</span>
                    <span className="truncate">{b.service?.name}</span>
                  </div>
                  <div className="flex items-center gap-1 mt-1">
                    {b.practitioner && (
                      <span
                        className="h-2 w-2 rounded-full shrink-0"
                        style={{ backgroundColor: b.practitioner.color }}
                      />
                    )}
                    <span className="text-[10px] text-gray-400">{b.practitioner?.name}</span>
                    <span className="ml-auto text-gray-400">
                      {getChannelIcon(b.source_channel)}
                    </span>
                  </div>
                </button>
              ))
            )}
          </CardContent>
        </Card>
      </aside>

      {/* Booking form dialog — key forces re-mount on each open so initial state is fresh */}
      <BookingForm
        key={`${formOpen ? "open" : "closed"}-${selectedBooking?.id ?? "new"}`}
        open={formOpen}
        onClose={handleFormClose}
        onSubmit={handleFormSubmit}
        initialDate={currentDate}
        editBooking={selectedBooking ?? undefined}
        practitioners={practitioners}
        services={services}
        clients={clients}
      />
    </div>
  );
};

export default AgendaContent;
