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
  Palette,
  Rows3,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import DayView from "@/components/agenda/day-view";
import WeekView from "@/components/agenda/week-view";
import MonthView from "@/components/agenda/month-view";
import BookingForm from "@/components/agenda/booking-form";
import BookingSummary from "@/components/agenda/booking-summary";
import BookingPendingReview from "@/components/agenda/booking-pending-review";
import PractitionerFilterDropdown from "@/components/agenda/practitioner-filter-dropdown";
import PractitionerPillsFilter from "@/components/agenda/practitioner-pills-filter";
import ColorLegend from "@/components/agenda/color-legend";
import { createClient } from "@/lib/supabase/client";
import type { Booking, Practitioner, Service, Client } from "@/types/supabase";

type ViewMode = "day" | "3day" | "week" | "month";
type ColorBy = "practitioner" | "service" | "state";
type Density = "compact" | "comfortable";

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
  if (view === "3day") {
    const end = new Date(date);
    end.setDate(date.getDate() + 2);
    const from = date.toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
    const to = end.toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" });
    return `${from} — ${to}`;
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
  else if (view === "3day") d.setDate(d.getDate() + direction * 3);
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

  // Color-by + density (persistés en localStorage) — refonte UI v2 (proto Claude Design)
  const [colorBy, setColorBy] = useState<ColorBy>("practitioner");
  const [density, setDensity] = useState<Density>("comfortable");
  const [summaryCollapsed, setSummaryCollapsed] = useState<boolean>(false);
  useEffect(() => {
    const sc = localStorage.getItem("agenda_color_by");
    if (sc === "practitioner" || sc === "service" || sc === "state") setColorBy(sc);
    const sd = localStorage.getItem("agenda_density");
    if (sd === "compact" || sd === "comfortable") setDensity(sd);
    const ss = localStorage.getItem("agenda_summary_collapsed");
    if (ss === "true" || ss === "false") setSummaryCollapsed(ss === "true");
  }, []);
  const handleColorByChange = (next: ColorBy) => {
    setColorBy(next);
    localStorage.setItem("agenda_color_by", next);
  };
  const toggleDensity = () => {
    setDensity((prev) => {
      const next = prev === "compact" ? "comfortable" : "compact";
      localStorage.setItem("agenda_density", next);
      return next;
    });
  };
  const toggleSummary = () => {
    setSummaryCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem("agenda_summary_collapsed", String(next));
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
  const threeDayStart = useMemo(() => {
    const d = new Date(currentDate);
    d.setHours(0, 0, 0, 0);
    return d;
  }, [currentDate]);

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
    setSlotPrefill(null);
  }, []);

  // Pré-remplissage praticien + date depuis clic sur la grille (vue Jour)
  const [slotPrefill, setSlotPrefill] = useState<{ practitionerId?: string; date: Date } | null>(null);
  const handleSlotClick = useCallback((practitionerId: string, dateAtSlot: Date) => {
    setSelectedBooking(null);
    setSlotPrefill({ practitionerId, date: dateAtSlot });
    setFormOpen(true);
  }, []);

  // Clic sur grille 3 jours / Semaine — pas de practitionerId direct (colonne = jour)
  // Pré-sélection auto si exactement 1 praticien actif dans le filtre OU 1 seul praticien total
  const handleSlotClickByDay = useCallback((dateAtSlot: Date, allowPrefill: boolean) => {
    setSelectedBooking(null);
    let prefilledId: string | undefined;
    if (allowPrefill) {
      const activeIds = practitioners.filter((p) => p.is_active).map((p) => p.id);
      if (selectedPractitionerIds.length === 1) prefilledId = selectedPractitionerIds[0];
      else if (selectedPractitionerIds.length === 0 && activeIds.length === 1) prefilledId = activeIds[0];
    }
    setSlotPrefill({ practitionerId: prefilledId, date: dateAtSlot });
    setFormOpen(true);
  }, [practitioners, selectedPractitionerIds]);

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
    <div className="flex h-full gap-4 -m-6" style={{ width: "calc(100% + 3rem)" }} data-agenda-density={density}>
      {/* Main calendar area */}
      <div className="flex flex-1 flex-col gap-3 min-w-0">
        {/* Header — proto Claude Design */}
        <div className="flex items-baseline gap-3.5 flex-wrap pt-1 px-1">
          <h1 className="m-0 text-[22px] font-bold tracking-[-0.02em] text-gray-900">Agenda</h1>
          <span className="text-[13px] capitalize" style={{ color: "var(--agenda-fg-muted)" }}>
            {new Date().toLocaleDateString("fr-FR", {
              weekday: "long",
              day: "numeric",
              month: "long",
              year: "numeric",
            })}
          </span>
          <div className="flex-1" />
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
          <button
            type="button"
            onClick={() => { setSelectedBooking(null); setFormOpen(true); }}
            className="inline-flex items-center gap-2 h-9 px-3.5 rounded-[10px] font-medium text-[13.5px] text-white shadow-sm transition-colors"
            style={{ backgroundColor: "var(--agenda-brand)" }}
            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "var(--agenda-brand-2)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "var(--agenda-brand)"; }}
          >
            <Plus className="h-4 w-4" />
            <span>Nouveau RDV</span>
          </button>
        </div>

        {/* Toolbar — proto Claude Design */}
        <div
          className="flex flex-wrap items-center gap-2 px-[22px] py-[10px]"
          style={{
            background: "var(--agenda-surface-2)",
            borderTop: "1px solid var(--agenda-border)",
            borderBottom: "1px solid var(--agenda-border)",
          }}
        >
          {/* Segmented — Aujourd'hui + vues regroupés */}
          <div
            className="inline-flex items-center gap-0.5 p-[3px] rounded-[10px]"
            style={{ background: "var(--agenda-surface)", border: "1px solid var(--agenda-border)" }}
          >
            <button
              onClick={goToToday}
              className="h-[30px] px-3 rounded-[7px] text-[13px] font-medium transition-colors"
              style={{ color: "var(--agenda-fg-muted)" }}
              onMouseEnter={(e) => { e.currentTarget.style.background = "var(--agenda-surface-3)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
            >
              Aujourd&apos;hui
            </button>
            <div className="w-px h-4 mx-0.5" style={{ background: "var(--agenda-border)" }} />
            {(["day", "3day", "week", "month"] as ViewMode[]).map((v) => {
              const active = view === v;
              const label = v === "day" ? "Jour" : v === "3day" ? "3 jours" : v === "week" ? "Semaine" : "Mois";
              return (
                <button
                  key={v}
                  onClick={() => setView(v)}
                  className="h-[30px] px-3 rounded-[7px] text-[13px] transition-colors"
                  style={{
                    background: active ? "var(--agenda-brand)" : "transparent",
                    color: active ? "white" : "var(--agenda-fg-muted)",
                    fontWeight: active ? 600 : 500,
                    boxShadow: active ? "0 1px 2px rgba(0,0,0,0.1)" : "none",
                  }}
                  onMouseEnter={(e) => { if (!active) e.currentTarget.style.background = "var(--agenda-surface-3)"; }}
                  onMouseLeave={(e) => { if (!active) e.currentTarget.style.background = "transparent"; }}
                >
                  {label}
                </button>
              );
            })}
          </div>

          {/* Navigation date */}
          <div className="flex items-center gap-0.5 ml-3">
            <button
              onClick={goBack}
              aria-label="Précédent"
              className="inline-flex items-center justify-center w-9 h-9 rounded-[10px] transition-colors"
              style={{ color: "var(--agenda-fg-muted)" }}
              onMouseEnter={(e) => { e.currentTarget.style.background = "var(--agenda-surface-3)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <div className="min-w-[200px] text-center font-semibold text-[14px] px-2" style={{ color: "var(--agenda-fg)" }}>
              {formatDateLabel(currentDate, view)}
            </div>
            <button
              onClick={goForward}
              aria-label="Suivant"
              className="inline-flex items-center justify-center w-9 h-9 rounded-[10px] transition-colors"
              style={{ color: "var(--agenda-fg-muted)" }}
              onMouseEnter={(e) => { e.currentTarget.style.background = "var(--agenda-surface-3)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          <div className="flex-1" />

          {/* Filtre praticien — avatars empilés + dropdown checklist */}
          <PractitionerFilterDropdown
            practitioners={practitioners}
            selected={selectedPractitionerIds}
            onChange={setSelectedPractitionerIds}
          />

          {/* Color-by select — style proto */}
          <select
            value={colorBy}
            onChange={(e) => handleColorByChange(e.target.value as ColorBy)}
            aria-label="Code couleur des RDV"
            className="h-8 px-2.5 rounded-[8px] text-[12.5px] font-medium cursor-pointer transition-colors focus:outline-none"
            style={{
              background: "var(--agenda-surface)",
              border: "1px solid var(--agenda-border)",
              color: "var(--agenda-fg)",
            }}
          >
            <option value="practitioner">Couleur : praticien</option>
            <option value="service">Couleur : service</option>
            <option value="state">Couleur : état</option>
          </select>

          {/* Density toggle — style proto */}
          <button
            type="button"
            onClick={toggleDensity}
            title={density === "compact" ? "Passer en mode confort" : "Passer en mode compact"}
            aria-label="Densité"
            className="inline-flex items-center gap-1.5 h-8 px-2.5 rounded-[8px] text-[12.5px] font-medium transition-colors"
            style={{
              background: "var(--agenda-surface)",
              border: "1px solid var(--agenda-border)",
              color: "var(--agenda-fg)",
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = "var(--agenda-surface-2)"; e.currentTarget.style.borderColor = "var(--agenda-border-strong)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = "var(--agenda-surface)"; e.currentTarget.style.borderColor = "var(--agenda-border)"; }}
          >
            <Rows3 className="h-3.5 w-3.5" />
            {density === "compact" ? "Compact" : "Confort"}
          </button>
        </div>

        {/* Color legend — visible quand colorBy ≠ praticien */}
        <ColorLegend colorBy={colorBy} />

        {/* Pills praticiens cliquables — sur toutes les vues sauf Mois */}
        {view !== "month" && (
          <PractitionerPillsFilter
            practitioners={practitioners}
            selected={selectedPractitionerIds}
            onChange={setSelectedPractitionerIds}
            label={
              view === "week" ? "Vue semaine de"
              : view === "3day" ? "Vue 3 jours de"
              : "Vue jour de"
            }
          />
        )}

        {/* Calendar view — flat, sans wrapper card (proto Claude Design) */}
        <div
          className="flex-1 overflow-hidden bg-white min-h-0"
          style={{ borderTop: "1px solid var(--agenda-border)" }}
        >
          {view === "day" && (
            <DayView
              bookings={visibleBookings}
              practitioners={practitioners}
              date={currentDate}
              onBookingClick={handleBookingClick}
              onSlotClick={handleSlotClick}
              newClientIds={newClientIds}
              highlightedBookingId={highlightedBookingId}
              colorBy={colorBy}
              density={density}
            />
          )}
          {view === "3day" && (
            <WeekView
              bookings={visibleBookings}
              practitioners={practitioners}
              weekStart={threeDayStart}
              selectedPractitionerIds={selectedPractitionerIds}
              onBookingClick={handleBookingClick}
              onSlotClick={(d) => handleSlotClickByDay(d, true)}
              newClientIds={newClientIds}
              highlightedBookingId={highlightedBookingId}
              colorBy={colorBy}
              density={density}
              daysCount={3}
            />
          )}
          {view === "week" && (
            <WeekView
              bookings={visibleBookings}
              practitioners={practitioners}
              weekStart={weekStart}
              selectedPractitionerIds={selectedPractitionerIds}
              onBookingClick={handleBookingClick}
              onSlotClick={(d) => handleSlotClickByDay(d, false)}
              newClientIds={newClientIds}
              highlightedBookingId={highlightedBookingId}
              colorBy={colorBy}
              density={density}
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

      {/* Summary panel — collapsible */}
      <aside
        className={`shrink-0 flex flex-col gap-3 transition-[width] duration-200 ${
          summaryCollapsed ? "w-10" : "w-72"
        }`}
      >
        {/* Bouton collapse/expand — toujours visible */}
        <div className="flex">
          <button
            type="button"
            onClick={toggleSummary}
            className={`group flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 hover:border-gray-300 transition-colors ${
              summaryCollapsed ? "w-full justify-center" : "ml-auto"
            }`}
            aria-label={summaryCollapsed ? "Afficher le résumé" : "Masquer le résumé"}
            title={summaryCollapsed ? "Afficher le résumé" : "Masquer le résumé"}
          >
            {summaryCollapsed ? (
              <ChevronLeft className="h-3.5 w-3.5" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5" />
            )}
            {!summaryCollapsed && <span>Réduire</span>}
          </button>
        </div>

        {/* Label vertical en mode collapsed */}
        {summaryCollapsed && (
          <div className="flex flex-1 items-center justify-center">
            <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-gray-400 [writing-mode:vertical-rl] rotate-180 select-none">
              Résumé du jour
            </span>
          </div>
        )}

        {/* Contenu — masqué en mode collapsed */}
        {!summaryCollapsed && (<>
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
                  <div className={`grid gap-1.5 ${showPending ? "grid-cols-3" : "grid-cols-2"}`}>
                    <div className="rounded-md bg-indigo-50 px-2 py-1 text-center">
                      <div className="text-base font-bold leading-tight text-indigo-700">{todayBookings.length}</div>
                      <div className="text-[10px] text-indigo-500 leading-tight">RDV total</div>
                    </div>
                    <div className="rounded-md bg-green-50 px-2 py-1 text-center">
                      <div className="flex items-center justify-center gap-1 leading-tight">
                        <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
                        <span className="text-base font-bold text-green-700">{confirmedCount}</span>
                      </div>
                      <div className="text-[10px] text-green-500 leading-tight">Confirmés</div>
                    </div>
                    {showPending && (
                      <div className="rounded-md bg-amber-50 px-2 py-1 text-center">
                        <div className="flex items-center justify-center gap-1 leading-tight">
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                          <span className="text-base font-bold text-amber-700">{pendingCount}</span>
                        </div>
                        <div className="text-[10px] text-amber-500 leading-tight">À confirmer</div>
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

        {/* EN COURS — proto Claude Design */}
        {(() => {
          if (currentClients.length === 0) {
            return (
              <div
                className="rounded-[10px] p-4 flex flex-col items-center justify-center min-h-[120px]"
                style={{
                  background: "var(--agenda-surface)",
                  border: "1px solid var(--agenda-border)",
                }}
              >
                <div
                  className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.08em] mb-2"
                  style={{ color: "var(--agenda-fg-subtle)" }}
                >
                  <span className="w-1.5 h-1.5 rounded-full" style={{ background: "var(--agenda-fg-subtle)" }} />
                  En cours
                </div>
                <p className="text-xs text-center" style={{ color: "var(--agenda-fg-subtle)" }}>
                  Aucun RDV en cours
                </p>
              </div>
            );
          }
          const idx = Math.min(currentClientIdx, currentClients.length - 1);
          const b = currentClients[idx];
          const client = b.client;
          const practitioner = b.practitioner;
          const service = b.service;
          const price = service ? (service.price_cents / 100).toFixed(2) : null;
          const isNoShow = b.status === "no_show";

          // Calcul du % écoulé et minutes restantes
          const startMs = new Date(b.starts_at).getTime();
          const endMs = new Date(b.ends_at).getTime();
          const nowMs = Date.now();
          const totalMs = Math.max(1, endMs - startMs);
          const elapsedMs = Math.max(0, Math.min(totalMs, nowMs - startMs));
          const elapsedPct = Math.round((elapsedMs / totalMs) * 100);
          const minRemaining = Math.max(0, Math.round((endMs - nowMs) / 60_000));
          const timeStart = new Date(b.starts_at).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
          const timeEnd = new Date(b.ends_at).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
          const loyaltyBadge: Record<string, { label: string; cls: string }> = {
            gold: { label: "GOLD", cls: "bg-yellow-100 text-yellow-700 border-yellow-300" },
            silver: { label: "SILVER", cls: "bg-gray-100 text-gray-600 border-gray-300" },
            bronze: { label: "BRONZE", cls: "bg-amber-100 text-amber-700 border-amber-300" },
          };
          const badge = client?.loyalty_tier ? loyaltyBadge[client.loyalty_tier] : null;

          return (
            <Card size="sm" style={{ borderColor: practitioner?.color ?? "var(--agenda-border)" }}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.08em]" style={{ color: "var(--agenda-fg-muted)" }}>
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
                    </span>
                    En cours
                  </div>
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

                  {/* Progress bar — % écoulé · min restantes (proto) */}
                  {!isNoShow && (
                    <div className="mt-3">
                      <div className="flex items-center justify-between text-[10px] mb-1" style={{ color: "var(--agenda-fg-muted)" }}>
                        <span>{timeStart} → {timeEnd}</span>
                        <span>
                          <span className="font-semibold" style={{ color: practitioner?.color ?? "var(--agenda-brand)" }}>{elapsedPct}%</span>
                          {" écoulé · "}
                          <span className="font-semibold">{minRemaining}</span>
                          {" min restantes"}
                        </span>
                      </div>
                      <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "var(--agenda-surface-3)" }}>
                        <div
                          className="h-full transition-all duration-500"
                          style={{
                            width: `${elapsedPct}%`,
                            background: practitioner?.color ?? "var(--agenda-brand)",
                          }}
                        />
                      </div>
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
        </>)}
      </aside>

      {/* Booking form dialog — key forces re-mount on each open so initial state is fresh */}
      <BookingForm
        key={`${formOpen ? "open" : "closed"}-${selectedBooking?.id ?? slotPrefill?.practitionerId ?? "new"}-${slotPrefill?.date?.getTime() ?? ""}-${clients.length}`}
        open={formOpen}
        onClose={handleFormClose}
        onSubmit={handleFormSubmit}
        onClientCreated={refreshClients}
        initialDate={slotPrefill?.date ?? currentDate}
        initialPractitionerId={slotPrefill?.practitionerId}
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
