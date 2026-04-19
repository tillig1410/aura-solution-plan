"use client";

import { useState, useCallback, useEffect, useMemo } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Plus,
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
  RotateCcw,
  UserX,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import DayView from "@/components/agenda/day-view";
import WeekView from "@/components/agenda/week-view";
import MonthView from "@/components/agenda/month-view";
import BookingForm from "@/components/agenda/booking-form";
import BookingSummary from "@/components/agenda/booking-summary";
import BookingPendingReview from "@/components/agenda/booking-pending-review";
import { createClient } from "@/lib/supabase/client";
import type { Booking, Practitioner, Service, Client } from "@/types/supabase";

type ViewMode = "day" | "week" | "month";

interface BookingWithDetails extends Booking {
  client: { id: string; name: string | null; phone: string | null; preferred_language: string; notes: string | null; loyalty_tier: string; loyalty_points: number } | null;
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
  const [pendingReviewOpen, setPendingReviewOpen] = useState(false);

  const [practitioners, setPractitioners] = useState<Practitioner[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [clients, setClients] = useState<(Client & { booking_count?: number; completed_count?: number })[]>([]);

  const newClientIds = useMemo(
    () => new Set(clients.filter((c) => (c.completed_count ?? 0) === 0).map((c) => c.id)),
    [clients],
  );

  // Toggle "Par canal" dans Résumé du jour (persisté en localStorage)
  const [showChannels, setShowChannels] = useState<boolean>(true);
  useEffect(() => {
    const stored = localStorage.getItem("agenda_show_channels");
    if (stored !== null) setShowChannels(stored === "true");
  }, []);
  const toggleChannels = () => {
    setShowChannels((prev) => {
      const next = !prev;
      localStorage.setItem("agenda_show_channels", String(next));
      return next;
    });
  };

  // Bookings masqués (annulés dont la notif a été dismissed)
  const [hiddenBookingIds, setHiddenBookingIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    const loadHidden = () => {
      const stored = JSON.parse(sessionStorage.getItem("agenda_hidden_bookings") || "[]") as string[];
      setHiddenBookingIds(new Set(stored));
    };
    loadHidden();
    window.addEventListener("agenda-hidden-bookings-changed", loadHidden);
    return () => window.removeEventListener("agenda-hidden-bookings-changed", loadHidden);
  }, []);

  // Booking surligné (depuis click "VOIR" sur une notif)
  const [highlightedBookingId, setHighlightedBookingId] = useState<string | null>(null);
  useEffect(() => {
    const loadHighlight = () => {
      setHighlightedBookingId(sessionStorage.getItem("agenda_highlighted_booking"));
    };
    loadHighlight();
    window.addEventListener("agenda-highlighted-booking-changed", loadHighlight);
    return () => window.removeEventListener("agenda-highlighted-booking-changed", loadHighlight);
  }, []);

  const visibleBookings = useMemo(
    () => bookings.filter((b) => !hiddenBookingIds.has(b.id)),
    [bookings, hiddenBookingIds],
  );
  const [merchantStatus, setMerchantStatus] = useState<{
    hasSubscription: boolean;
    trialEnd: string | null;
    voiceEnabled: boolean;
    autoConfirm: boolean;
  } | null>(null);

  const fetchAllData = useCallback(async () => {
    // Fetch merchant status
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data: merchant } = await supabase
        .from("merchants")
        .select("stripe_subscription_id, created_at, voice_enabled, auto_confirm_bookings")
        .eq("user_id", user.id)
        .single();
      if (merchant) {
        const trialEnd = new Date(new Date(merchant.created_at).getTime() + 14 * 24 * 60 * 60 * 1000);
        setMerchantStatus({
          hasSubscription: !!merchant.stripe_subscription_id,
          trialEnd: trialEnd.toISOString(),
          voiceEnabled: !!merchant.voice_enabled,
          autoConfirm: !!merchant.auto_confirm_bookings,
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

  // Re-fetch when page becomes visible (user comes back from another page/tab)
  useEffect(() => {
    const handler = () => {
      if (document.visibilityState === "visible") fetchAllData();
    };
    document.addEventListener("visibilitychange", handler);
    return () => document.removeEventListener("visibilitychange", handler);
  }, [fetchAllData]);

  // Realtime: auto-refresh bookings on INSERT/UPDATE/DELETE
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel("bookings-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "bookings" },
        () => { fetchAllData(); }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [fetchAllData]);

  // Listen for notification "VOIR" navigation
  useEffect(() => {
    const handler = () => {
      const dateStr = sessionStorage.getItem("agenda_goto_date");
      if (dateStr) {
        sessionStorage.removeItem("agenda_goto_date");
        setCurrentDate(new Date(dateStr + "T12:00:00"));
        setView("day");
      }
    };
    // Check on mount (when navigating from another page)
    handler();
    window.addEventListener("agenda-goto-date", handler);
    return () => window.removeEventListener("agenda-goto-date", handler);
  }, []);

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

  // Current clients: bookings in_progress, confirmed/pending that have started, or recently marked no_show
  const currentClients = useMemo(() => {
    const now = new Date();
    return todayBookings
      .filter((b) => {
        if (b.status === "cancelled" || b.status === "completed") return false;
        if (b.status === "in_progress") return true;
        // No-show: keep visible if the booking was during current time window
        if (b.status === "no_show" && new Date(b.starts_at) <= now && new Date(b.ends_at) > new Date(now.getTime() - 30 * 60_000)) return true;
        // Confirmed or pending: show only if started and not yet ended
        if (new Date(b.starts_at) <= now && new Date(b.ends_at) > now) return true;
        return false;
      })
      .sort((a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime());
  }, [todayBookings]);

  const [currentClientIdx, setCurrentClientIdx] = useState(0);

  const currentClientIds = useMemo(() => new Set(currentClients.map((b) => b.id)), [currentClients]);

  const upcomingBookings = useMemo(() => {
    const now = new Date();
    return todayBookings
      .filter(
        (b) =>
          new Date(b.starts_at) >= now &&
          b.status !== "cancelled" &&
          b.status !== "no_show" &&
          !currentClientIds.has(b.id)
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
    } else if (b.status === "pending") {
      setPendingReviewOpen(true);
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
    setSummaryOpen(false);
    setSelectedBooking(null);
    setFormOpen(true);
  }, []);

  const handlePendingClose = useCallback(() => {
    setPendingReviewOpen(false);
    setSelectedBooking(null);
  }, []);

  const handlePendingConfirm = useCallback(async () => {
    if (!selectedBooking) return;
    await fetch(`/api/v1/bookings/${selectedBooking.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ version: selectedBooking.version, status: "confirmed" }),
    });
    setPendingReviewOpen(false);
    setSelectedBooking(null);
    await refreshBookings();
  }, [selectedBooking, refreshBookings]);

  const handlePendingRefuse = useCallback(async () => {
    if (!selectedBooking) return;
    await fetch(`/api/v1/bookings/${selectedBooking.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ version: selectedBooking.version, status: "cancelled", cancelled_by: "merchant" }),
    });
    setPendingReviewOpen(false);
    setSelectedBooking(null);
    await refreshBookings();
  }, [selectedBooking, refreshBookings]);

  const handlePendingModify = useCallback(() => {
    setPendingReviewOpen(false);
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
          {/* Aujourd'hui — déplacé à gauche, plus visible */}
          <button
            onClick={goToToday}
            className="px-3 py-1.5 text-sm font-medium rounded-lg bg-indigo-50 text-indigo-700 border border-indigo-200 hover:bg-indigo-100 transition-colors"
          >
            Aujourd&apos;hui
          </button>

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
              bookings={visibleBookings}
              practitioners={practitioners}
              date={currentDate}
              onBookingClick={handleBookingClick}
              newClientIds={newClientIds}
              highlightedBookingId={highlightedBookingId}
            />
          )}
          {view === "week" && (
            <WeekView
              bookings={visibleBookings}
              practitioners={practitioners}
              weekStart={weekStart}
              selectedPractitionerIds={selectedPractitionerIds}
              onBookingClick={handleBookingClick}
              newClientIds={newClientIds}
              highlightedBookingId={highlightedBookingId}
            />
          )}
          {view === "month" && (
            <MonthView
              bookings={visibleBookings}
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
            {(() => {
              const confirmedCount = todayBookings.filter((b) => b.status === "confirmed" || b.status === "in_progress" || b.status === "completed").length;
              const pendingCount = todayBookings.filter((b) => b.status === "pending").length;
              const showPending = !merchantStatus?.autoConfirm;
              return (
                <div>
                  <div className={`grid gap-2 ${showPending ? "grid-cols-3" : "grid-cols-2"}`}>
                    <div className="rounded-lg bg-indigo-50 px-2 py-2 text-center">
                      <div className="text-2xl font-bold text-indigo-700">{todayBookings.length}</div>
                      <div className="text-xs text-indigo-500">RDV total</div>
                    </div>
                    <div className="rounded-lg bg-green-50 px-2 py-2 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-green-500" />
                        <span className="text-2xl font-bold text-green-700">{confirmedCount}</span>
                      </div>
                      <div className="text-xs text-green-500">Confirmés</div>
                    </div>
                    {showPending && (
                      <div className="rounded-lg bg-amber-50 px-2 py-2 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-amber-500" />
                          <span className="text-2xl font-bold text-amber-700">{pendingCount}</span>
                        </div>
                        <div className="text-xs text-amber-500">À confirmer</div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })()}

            {/* Canaux (collapsible) */}
            <div>
              <button
                onClick={toggleChannels}
                className="flex items-center gap-1 text-xs font-medium text-gray-500 mb-1.5 hover:text-gray-700 transition-colors w-full"
              >
                <span className="flex-1 text-left">Par canal</span>
                {showChannels ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
              </button>
              {showChannels && (
                <div className="flex flex-col gap-1">
                  {(["dashboard", "whatsapp", "messenger", "telegram", "sms", "voice"] as Booking["source_channel"][])
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
              )}
            </div>
          </CardContent>
        </Card>

        {/* Client actuel — toujours visible */}
        {(() => {
          if (currentClients.length === 0) {
            return (
              <Card size="sm" className="min-h-[200px]">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-sm">
                    <User className="h-4 w-4 text-indigo-600" />
                    Client actuel
                  </CardTitle>
                </CardHeader>
                <CardContent className="flex items-center justify-center flex-1">
                  <p className="text-xs text-gray-400 text-center">Aucun client en cours</p>
                </CardContent>
              </Card>
            );
          }
          const idx = Math.min(currentClientIdx, currentClients.length - 1);
          const b = currentClients[idx];
          const client = b.client;
          const practitioner = b.practitioner;
          const service = b.service;
          const price = service ? (service.price_cents / 100).toFixed(2) : null;
          const isNoShow = b.status === "no_show";
          const loyaltyBadge: Record<string, { label: string; cls: string }> = {
            gold: { label: "GOLD", cls: "bg-yellow-100 text-yellow-700 border-yellow-300" },
            silver: { label: "SILVER", cls: "bg-gray-100 text-gray-600 border-gray-300" },
            bronze: { label: "BRONZE", cls: "bg-amber-100 text-amber-700 border-amber-300" },
          };
          const badge = client?.loyalty_tier ? loyaltyBadge[client.loyalty_tier] : null;

          return (
            <Card size="sm">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2 text-sm">
                    <User className="h-4 w-4 text-indigo-600" />
                    Client actuel
                  </CardTitle>
                  <div className="flex items-center gap-1.5 text-xs text-gray-400">
                    <button
                      onClick={() => setCurrentClientIdx((i) => Math.max(0, i - 1))}
                      disabled={idx === 0}
                      className="w-5 h-5 rounded-full border border-gray-200 flex items-center justify-center hover:bg-gray-100 disabled:opacity-30 transition-colors"
                    >
                      <ChevronLeft className="h-3 w-3" />
                    </button>
                    <span className="text-xs font-medium">{idx + 1} / {currentClients.length}</span>
                    <button
                      onClick={() => setCurrentClientIdx((i) => Math.min(currentClients.length - 1, i + 1))}
                      disabled={idx === currentClients.length - 1}
                      className="w-5 h-5 rounded-full border border-gray-200 flex items-center justify-center hover:bg-gray-100 disabled:opacity-30 transition-colors"
                    >
                      <ChevronRight className="h-3 w-3" />
                    </button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="flex flex-col gap-3">
                {/* Inner card with practitioner color border */}
                <div
                  className={`rounded-xl p-4 bg-white relative ${isNoShow ? "opacity-50 grayscale" : ""}`}
                  style={{
                    border: `3px solid ${isNoShow ? "#9ca3af" : (practitioner?.color ?? "#6366f1")}`,
                    boxShadow: "0 2px 8px rgba(0,0,0,0.10)",
                  }}
                >
                  {/* No-show overlay badge */}
                  {isNoShow && (
                    <div className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none">
                      <span className="text-sm font-bold text-red-600 bg-red-50 border border-red-200 px-4 py-2 rounded-xl rotate-[-8deg] shadow">
                        CLIENT ABSENT
                      </span>
                    </div>
                  )}
                  {/* Practitioner badge — top right */}
                  {practitioner && (
                    <div className="absolute -top-3 right-3">
                      <span
                        className="text-[10px] font-bold text-white px-2.5 py-1 rounded-full uppercase tracking-wide"
                        style={{ backgroundColor: practitioner.color }}
                      >
                        Avec {practitioner.name}
                      </span>
                    </div>
                  )}

                  {/* Client info */}
                  <div className="flex items-center gap-3 mt-1">
                    <div className="w-11 h-11 rounded-full bg-gray-100 flex items-center justify-center shrink-0">
                      <User className="h-5 w-5 text-gray-500" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-base font-bold text-gray-900 truncate">
                        {client?.name ?? "Client inconnu"}
                      </p>
                      <p className="text-sm text-gray-500 truncate">{service?.name}</p>
                    </div>
                  </div>

                  {/* Loyalty badge — own row */}
                  {badge && (
                    <div className="mt-2">
                      <span className={`text-[9px] font-bold px-2 py-0.5 rounded border ${badge.cls}`}>
                        {badge.label}
                      </span>
                    </div>
                  )}

                  {/* Notes */}
                  <div className="mt-3 rounded-lg bg-green-50 border border-green-100 px-3 py-2.5">
                    <div className="flex items-start gap-2">
                      <span className="text-green-500 mt-0.5 shrink-0">&#x1F4AC;</span>
                      <p className="text-xs text-gray-600 leading-relaxed italic">
                        {client?.notes ? `"${client.notes}"` : "Aucune note"}
                      </p>
                    </div>
                  </div>

                  {/* Price + payment status */}
                  {price && (() => {
                    // TODO: check real payment status when Stripe is connected
                    const paidOnline = false;
                    return (
                      <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-100">
                        <div>
                          <div className="text-[10px] text-gray-400 uppercase">Total</div>
                          <div className="text-2xl font-bold text-gray-900">{price} €</div>
                        </div>
                        {paidOnline ? (
                          <span className="text-[10px] font-bold rounded-full px-2.5 py-1 bg-green-100 text-green-700 flex items-center gap-1">
                            &#x2705; Paiement effectué
                          </span>
                        ) : (
                          <span className="text-[10px] font-bold rounded-full px-2.5 py-1 bg-orange-100 text-orange-700">
                            À encaisser
                          </span>
                        )}
                      </div>
                    );
                  })()}

                  {/* Action buttons */}
                  {!isNoShow && (
                    <div className="flex flex-col gap-2 mt-3">
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full gap-2"
                      >
                        <CreditCard className="h-3.5 w-3.5" />
                        Encaissement
                      </Button>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-1 gap-1.5 text-xs"
                          onClick={() => {
                            setSelectedBooking(null);
                            setFormOpen(true);
                          }}
                        >
                          <RotateCcw className="h-3 w-3" />
                          Reprogrammer
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-1 gap-1.5 text-xs text-red-600 border-red-200 hover:bg-red-50"
                          onClick={async () => {
                            await fetch(`/api/v1/bookings/${b.id}`, {
                              method: "PATCH",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({ version: b.version, status: "no_show" }),
                            });
                            await refreshBookings();
                          }}
                        >
                          <UserX className="h-3 w-3" />
                          Absent
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })()}

        {/* RDV à venir */}
        <Card size="sm" className="flex-1 overflow-hidden">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm">Prochains RDV</CardTitle>
              <span className="text-xs text-indigo-600 font-semibold">{upcomingBookings.length} restant{upcomingBookings.length > 1 ? "s" : ""}</span>
            </div>
          </CardHeader>
          <CardContent className="overflow-y-auto flex flex-col gap-2 max-h-96">
            {upcomingBookings.length === 0 ? (
              <p className="text-xs text-muted-foreground">Aucun RDV à venir aujourd&apos;hui.</p>
            ) : (
              upcomingBookings.map((b) => (
                <div
                  key={b.id}
                  className="rounded-lg border border-gray-100 p-2.5 hover:bg-gray-50 transition-colors"
                >
                  <button
                    onClick={() => handleBookingClick(b)}
                    className="w-full text-left"
                  >
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <span className="text-xs font-medium text-gray-800 truncate min-w-0">
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
                    <div className="flex items-center mt-1">
                      {b.practitioner && (
                        <span
                          className="text-[10px] font-medium text-white rounded-full px-1.5 py-0.5 inline-flex items-center gap-1"
                          style={{ backgroundColor: b.practitioner.color }}
                        >
                          <span className="w-1.5 h-1.5 rounded-full bg-white/60" />
                          {b.practitioner.name}
                        </span>
                      )}
                    </div>
                  </button>
                  {b.status === "pending" && (
                    <button
                      onClick={async (e) => {
                        e.stopPropagation();
                        await fetch(`/api/v1/bookings/${b.id}`, {
                          method: "PATCH",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ version: b.version, status: "confirmed" }),
                        });
                        await refreshBookings();
                      }}
                      className="mt-2 w-full text-xs font-semibold text-green-700 bg-green-50 hover:bg-green-100 border border-green-200 rounded-lg py-1.5 transition-colors"
                    >
                      Confirmer ce RDV
                    </button>
                  )}
                </div>
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
          isNewClient={!!selectedBooking.client && newClientIds.has(selectedBooking.client.id)}
        />
      )}

      {/* Pending booking review dialog */}
      {selectedBooking && pendingReviewOpen && (
        <BookingPendingReview
          open={pendingReviewOpen}
          onClose={handlePendingClose}
          onConfirm={handlePendingConfirm}
          onRefuse={handlePendingRefuse}
          onModify={handlePendingModify}
          booking={selectedBooking}
        />
      )}
    </div>
  );
};

export default AgendaContent;
