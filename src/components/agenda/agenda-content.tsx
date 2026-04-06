"use client";

import { useState, useCallback, useEffect, useMemo } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  Bell,
  CalendarDays,
  MessageSquare,
  MessageCircle,
  Send,
  Phone,
  PhoneCall,
  Monitor,
  Globe,
  User,
  CreditCard,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import DayView from "@/components/agenda/day-view";
import WeekView from "@/components/agenda/week-view";
import MonthView from "@/components/agenda/month-view";
import BookingForm from "@/components/agenda/booking-form";
import BookingSummary from "@/components/agenda/booking-summary";
import { createClient } from "@/lib/supabase/client";
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

const CHANNEL_CONFIG: Record<Booking["source_channel"], { label: string; icon: React.ReactNode; color: string }> = {
  whatsapp: { label: "WhatsApp", icon: <MessageSquare className="h-3.5 w-3.5" />, color: "text-green-600" },
  messenger: { label: "Messenger", icon: <MessageCircle className="h-3.5 w-3.5" />, color: "text-blue-500" },
  telegram: { label: "Telegram", icon: <Send className="h-3.5 w-3.5" />, color: "text-sky-500" },
  sms: { label: "SMS", icon: <Phone className="h-3.5 w-3.5" />, color: "text-gray-500" },
  voice: { label: "Tél IA", icon: <PhoneCall className="h-3.5 w-3.5" />, color: "text-purple-600" },
  dashboard: { label: "Dashboard", icon: <Monitor className="h-3.5 w-3.5" />, color: "text-gray-500" },
  booking_page: { label: "Site résa", icon: <Globe className="h-3.5 w-3.5" />, color: "text-indigo-500" },
};

const getChannelIcon = (channel: Booking["source_channel"]) => {
  return CHANNEL_CONFIG[channel]?.icon ?? <Monitor className="h-3.5 w-3.5" />;
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

// ---------- (mock data removed — real fetches below) ----------

// Real data is now fetched from the API in the component below

// ---------- component ----------

const AgendaContent = () => {
  const [view, setView] = useState<ViewMode>("week");
  const [currentDate, setCurrentDate] = useState<Date>(() => new Date());
  const [selectedPractitionerIds, setSelectedPractitionerIds] = useState<string[]>([]);
  const [bookings, setBookings] = useState<BookingWithDetails[]>([]);
  const [selectedBooking, setSelectedBooking] = useState<BookingWithDetails | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [summaryOpen, setSummaryOpen] = useState(false);

  const [practitioners, setPractitioners] = useState<Practitioner[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [merchantStatus, setMerchantStatus] = useState<{
    hasSubscription: boolean;
    trialEnd: string | null;
    voiceEnabled: boolean;
  } | null>(null);

  const fetchAllData = useCallback(async () => {
    // Fetch merchant status
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data: merchant } = await supabase
        .from("merchants")
        .select("stripe_subscription_id, created_at, voice_enabled")
        .eq("user_id", user.id)
        .single();
      if (merchant) {
        const trialEnd = new Date(new Date(merchant.created_at).getTime() + 14 * 24 * 60 * 60 * 1000);
        setMerchantStatus({
          hasSubscription: !!merchant.stripe_subscription_id,
          trialEnd: trialEnd.toISOString(),
          voiceEnabled: !!merchant.voice_enabled,
        });
      }
    }

    const [pracRes, svcRes, clientRes, bookRes] = await Promise.all([
      fetch("/api/v1/practitioners"),
      fetch("/api/v1/services"),
      fetch("/api/v1/clients"),
      fetch("/api/v1/bookings"),
    ]);
    if (pracRes.ok) {
      const json = await pracRes.json();
      setPractitioners(json.data ?? json);
    }
    if (svcRes.ok) {
      const json = await svcRes.json();
      setServices(json.data ?? json);
    }
    if (clientRes.ok) {
      const json = await clientRes.json();
      setClients(json.data ?? json);
    }
    if (bookRes.ok) {
      const json = await bookRes.json();
      setBookings(json.data ?? json);
    }
  }, []);

  useEffect(() => {
    fetchAllData();
  }, [fetchAllData]);

  const refreshClients = useCallback(async () => {
    const res = await fetch("/api/v1/clients");
    if (res.ok) {
      const json = await res.json();
      setClients(json.data ?? json);
    }
  }, []);

  const weekStart = useMemo(() => getMonday(currentDate), [currentDate]);

  // Today's bookings for the summary panel
  const todayStr = new Date().toDateString();
  const todayBookings = useMemo(
    () => bookings.filter((b) => new Date(b.starts_at).toDateString() === todayStr),
    [bookings, todayStr]
  );

  // Current clients: bookings in_progress or confirmed starting within 15 min
  const currentClients = useMemo(() => {
    const now = new Date();
    const soon = new Date(now.getTime() + 15 * 60_000);
    return todayBookings
      .filter((b) => {
        if (b.status === "in_progress") return true;
        if (b.status === "confirmed" && new Date(b.starts_at) <= soon && new Date(b.ends_at) > now) return true;
        return false;
      })
      .sort((a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime());
  }, [todayBookings]);

  const [currentClientIdx, setCurrentClientIdx] = useState(0);

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
    const isPast = b.status === "completed" || b.status === "cancelled" || b.status === "no_show" || new Date(b.ends_at) < new Date();
    setSelectedBooking(b);
    if (isPast) {
      setSummaryOpen(true);
    } else {
      setFormOpen(true);
    }
  }, []);

  const handleDayClick = useCallback((d: Date) => {
    setCurrentDate(d);
    setView("day");
  }, []);

  const refreshBookings = useCallback(async () => {
    const res = await fetch("/api/v1/bookings");
    if (res.ok) {
      const json = await res.json();
      setBookings(json.data ?? json);
    }
  }, []);

  const handleFormSubmit = useCallback(
    async (data: CreateBookingData) => {
      if (selectedBooking) {
        // Edit mode — call PATCH API
        const res = await fetch(`/api/v1/bookings/${selectedBooking.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            version: selectedBooking.version,
            starts_at: data.starts_at,
            ends_at: data.ends_at,
            practitioner_id: data.practitioner_id,
            service_id: data.service_id,
          }),
        });
        if (!res.ok) return;
      } else {
        // Create mode — call POST API
        const res = await fetch("/api/v1/bookings", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        });
        if (!res.ok) return;
      }

      setFormOpen(false);
      setSelectedBooking(null);
      await refreshBookings();
    },
    [selectedBooking, refreshBookings]
  );

  const handleFormClose = useCallback(() => {
    setFormOpen(false);
    setSelectedBooking(null);
  }, []);

  const handleSummaryClose = useCallback(() => {
    setSummaryOpen(false);
    setSelectedBooking(null);
  }, []);

  const handleReschedule = useCallback(() => {
    // Close summary, open form in create mode with same client/service pre-filled
    setSummaryOpen(false);
    setSelectedBooking(null);
    setFormOpen(true);
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
          <div className="flex flex-col items-end gap-1">
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
            {merchantStatus && (() => {
              const isActive = merchantStatus.hasSubscription;
              const trialExpired = !isActive && merchantStatus.trialEnd && new Date(merchantStatus.trialEnd) < new Date();
              const label = isActive ? "Actif" : trialExpired ? "Essai expiré" : "Période d'essai";
              const colors = isActive
                ? "bg-green-50 text-green-600"
                : trialExpired
                  ? "bg-red-50 text-red-600"
                  : "bg-amber-50 text-amber-600";
              const dateText = !isActive && merchantStatus.trialEnd
                ? `Essai jusqu'au ${new Date(merchantStatus.trialEnd).toLocaleDateString("fr-FR", { day: "numeric", month: "long" })}`
                : null;
              return (
                <div className="flex items-center gap-1.5">
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${colors}`}>
                    {label}
                  </span>
                  {dateText && <span className="text-xs text-gray-400">{dateText}</span>}
                </div>
              );
            })()}
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
            <div>
              <div className="text-xs font-medium text-gray-500 mb-1.5">Par canal</div>
              <div className="flex flex-col gap-1">
                {(["dashboard", "booking_page", "whatsapp", "messenger", "telegram", "sms", "voice"] as Booking["source_channel"][])
                  .filter((ch) => ch !== "voice" || merchantStatus?.voiceEnabled)
                  .map((channel) => {
                    const config = CHANNEL_CONFIG[channel];
                    const count = channelCounts[channel] ?? 0;
                    return (
                      <div key={channel} className="flex items-center gap-2 text-xs text-gray-600">
                        <span className={config.color}>{config.icon}</span>
                        <span className="flex-1">{config.label}</span>
                        <span className={`font-medium ${count > 0 ? "text-gray-800" : "text-gray-300"}`}>{count}</span>
                      </div>
                    );
                  })}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Client actuel */}
        {currentClients.length > 0 && (() => {
          const idx = Math.min(currentClientIdx, currentClients.length - 1);
          const b = currentClients[idx];
          const client = b.client;
          const practitioner = b.practitioner;
          const service = b.service;
          const price = service ? (service.price_cents / 100).toFixed(2) : null;
          const timeRange = `${new Date(b.starts_at).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })} — ${new Date(b.ends_at).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}`;

          return (
            <Card size="sm">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2 text-sm">
                    <User className="h-4 w-4 text-indigo-600" />
                    Client actuel
                  </CardTitle>
                  {currentClients.length > 1 && (
                    <div className="flex items-center gap-1 text-xs text-gray-400">
                      <button
                        onClick={() => setCurrentClientIdx((i) => Math.max(0, i - 1))}
                        disabled={idx === 0}
                        className="px-1 hover:text-gray-600 disabled:opacity-30"
                      >
                        &lt;
                      </button>
                      <span>{idx + 1} / {currentClients.length}</span>
                      <button
                        onClick={() => setCurrentClientIdx((i) => Math.min(currentClients.length - 1, i + 1))}
                        disabled={idx === currentClients.length - 1}
                        className="px-1 hover:text-gray-600 disabled:opacity-30"
                      >
                        &gt;
                      </button>
                    </div>
                  )}
                </div>
              </CardHeader>
              <CardContent className="flex flex-col gap-2.5">
                {/* Practitioner badge */}
                {practitioner && (
                  <div className="flex justify-end">
                    <span
                      className="text-[10px] font-semibold text-white px-2 py-0.5 rounded-full"
                      style={{ backgroundColor: practitioner.color }}
                    >
                      AVEC {practitioner.name.toUpperCase()}
                    </span>
                  </div>
                )}

                {/* Client info */}
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center shrink-0">
                    <User className="h-5 w-5 text-indigo-600" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-gray-900 truncate">
                      {client?.name ?? "Client inconnu"}
                    </p>
                    <p className="text-xs text-gray-500 truncate">{service?.name}</p>
                  </div>
                </div>

                {/* Time + service details */}
                <div className="rounded-lg bg-gray-50 px-3 py-2 text-xs text-gray-600">
                  <span className="font-medium text-gray-800">{timeRange}</span>
                  {service && (
                    <span className="text-gray-400 ml-2">({service.duration_minutes} min)</span>
                  )}
                </div>

                {/* Price + status */}
                {price && (
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-[10px] text-gray-400 uppercase">Total</div>
                      <div className="text-lg font-bold text-gray-900">{price} €</div>
                    </div>
                    <span className={`text-[10px] font-medium rounded-full px-2 py-0.5 ${statusColor[b.status]}`}>
                      {statusLabel[b.status]}
                    </span>
                  </div>
                )}

                {/* Encaissement button */}
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full gap-2"
                  onClick={() => handleBookingClick(b)}
                >
                  <CreditCard className="h-3.5 w-3.5" />
                  Encaissement
                </Button>
              </CardContent>
            </Card>
          );
        })()}

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
        key={`${formOpen ? "open" : "closed"}-${selectedBooking?.id ?? "new"}-${clients.length}`}
        open={formOpen}
        onClose={handleFormClose}
        onSubmit={handleFormSubmit}
        onClientCreated={refreshClients}
        initialDate={currentDate}
        editBooking={selectedBooking ?? undefined}
        practitioners={practitioners}
        services={services}
        clients={clients}
      />

      {/* Past booking summary dialog */}
      {selectedBooking && summaryOpen && (
        <BookingSummary
          open={summaryOpen}
          onClose={handleSummaryClose}
          onReschedule={handleReschedule}
          booking={selectedBooking}
        />
      )}
    </div>
  );
};

export default AgendaContent;
