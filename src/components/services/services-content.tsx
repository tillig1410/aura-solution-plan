"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Plus,
  Pencil,
  Trash2,
  Scissors,
  Users,
  Clock,
  CalendarOff,
  Save,
  ArrowUpCircle,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import PractitionerManager from "@/components/settings/practitioner-manager";
import { createClient } from "@/lib/supabase/client";
import type { Service, Practitioner } from "@/types/supabase";

// ---------- Types ----------

interface ServiceWithPractitioners extends Service {
  practitioner_ids: string[];
}

interface PractitionerAvailabilityRow {
  id: string;
  practitioner_id: string;
  merchant_id: string;
  day_of_week: number | null;
  start_time: string;
  end_time: string;
  is_available: boolean;
  exception_date: string | null;
  created_at: string;
}

interface PractitionerWithServices extends Practitioner {
  service_ids: string[];
  availability: PractitionerAvailabilityRow[];
}

type Tab = "services" | "praticiens" | "horaires" | "fermetures";

const TABS: { value: Tab; label: string; icon: React.ReactNode }[] = [
  { value: "services", label: "Services", icon: <Scissors className="h-4 w-4" /> },
  { value: "praticiens", label: "Praticiens", icon: <Users className="h-4 w-4" /> },
  { value: "horaires", label: "Horaires", icon: <Clock className="h-4 w-4" /> },
  { value: "fermetures", label: "Fermetures", icon: <CalendarOff className="h-4 w-4" /> },
];

const DURATION_OPTIONS = [15, 20, 30, 45, 60, 75, 90, 120, 150, 180];

const formatDuration = (min: number): string => {
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m > 0 ? `${h}h${String(m).padStart(2, "0")}` : `${h}h`;
};

const formatPrice = (cents: number): string => `${(cents / 100).toFixed(2).replace(".", ",")} €`;

const DAY_LABELS = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"];

// ---------- Component ----------

const ServicesContent = () => {
  const [tab, setTab] = useState<Tab>("services");
  const [services, setServices] = useState<ServiceWithPractitioners[]>([]);
  const [practitioners, setPractitioners] = useState<PractitionerWithServices[]>([]);
  const [loading, setLoading] = useState(true);
  const [seatCount, setSeatCount] = useState(1);

  // Delete confirmation
  const [deleteTarget, setDeleteTarget] = useState<ServiceWithPractitioners | null>(null);

  // Service dialog
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingService, setEditingService] = useState<ServiceWithPractitioners | null>(null);
  const [svcName, setSvcName] = useState("");
  const [svcDesc, setSvcDesc] = useState("");
  const [svcDuration, setSvcDuration] = useState(30);
  const [svcPriceEuros, setSvcPriceEuros] = useState("");
  const [svcPracIds, setSvcPracIds] = useState<string[]>([]);
  const [svcSaving, setSvcSaving] = useState(false);
  const [svcError, setSvcError] = useState<string | null>(null);

  // Horaires state
  interface DaySlot { enabled: boolean; start: string; end: string; breakStart: string; breakEnd: string }
  const [scheduleByPrac, setScheduleByPrac] = useState<Record<string, DaySlot[]>>({});
  const [scheduleSaving, setScheduleSaving] = useState(false);

  // Congés state
  const [vacationByPrac, setVacationByPrac] = useState<Record<string, string[]>>({});
  const [vacationInputs, setVacationInputs] = useState<Record<string, { from: string; to: string }>>({});

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      // Fetch seat_count from merchant
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: merchant } = await supabase
          .from("merchants")
          .select("seat_count")
          .eq("user_id", user.id)
          .single();
        if (merchant) setSeatCount(merchant.seat_count);
      }

      const [svcRes, pracRes] = await Promise.all([
        fetch("/api/v1/services?include_inactive=true"),
        fetch("/api/v1/practitioners?include_inactive=true"),
      ]);
      if (svcRes.ok) {
        const svcJson = await svcRes.json();
        setServices((svcJson.data ?? svcJson) as ServiceWithPractitioners[]);
      }
      if (pracRes.ok) {
        const pracJson = await pracRes.json();
        const pracs = (pracJson.data ?? pracJson) as PractitionerWithServices[];
        setPractitioners(pracs);

        // Build schedule + vacations from availability data
        const sched: Record<string, DaySlot[]> = {};
        const vacations: Record<string, string[]> = {};
        for (const p of pracs) {
          const days: DaySlot[] = DAY_LABELS.map((_, i) => {
            const match = p.availability.find(
              (a) => a.day_of_week === i && a.exception_date === null,
            );
            return match
              ? { enabled: match.is_available, start: match.start_time.slice(0, 5), end: match.end_time.slice(0, 5), breakStart: "12:00", breakEnd: "13:00" }
              : { enabled: i < 6, start: "09:00", end: "19:00", breakStart: "12:00", breakEnd: "13:00" };
          });
          sched[p.id] = days;
          vacations[p.id] = p.availability
            .filter((a) => a.exception_date !== null && !a.is_available)
            .map((a) => a.exception_date as string)
            .sort();
        }
        setScheduleByPrac(sched);
        setVacationByPrac(vacations);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // ---- Service CRUD ----

  const openNewService = () => {
    setEditingService(null);
    setSvcName("");
    setSvcDesc("");
    setSvcDuration(30);
    setSvcPriceEuros("");
    setSvcPracIds([]);
    setSvcError(null);
    setDialogOpen(true);
  };

  const openEditService = (svc: ServiceWithPractitioners) => {
    setEditingService(svc);
    setSvcName(svc.name);
    setSvcDesc(svc.description ?? "");
    setSvcDuration(svc.duration_minutes);
    setSvcPriceEuros((svc.price_cents / 100).toFixed(2));
    setSvcPracIds(svc.practitioner_ids);
    setSvcError(null);
    setDialogOpen(true);
  };

  const confirmDeleteService = async () => {
    if (!deleteTarget) return;
    const res = await fetch(`/api/v1/services/${deleteTarget.id}`, { method: "DELETE" });
    if (res.ok) {
      toast.success("Service désactivé");
    } else {
      toast.error("Erreur lors de la désactivation");
    }
    setDeleteTarget(null);
    fetchData();
  };

  const handleSaveService = async () => {
    if (svcName.trim().length < 2) {
      setSvcError("Le nom doit contenir au moins 2 caractères");
      return;
    }
    const priceCents = Math.round(parseFloat(svcPriceEuros.replace(",", ".")) * 100);
    if (isNaN(priceCents) || priceCents < 0) {
      setSvcError("Prix invalide");
      return;
    }
    setSvcSaving(true);
    setSvcError(null);

    try {
      const body = {
        name: svcName.trim(),
        description: svcDesc.trim() || null,
        duration_minutes: svcDuration,
        price_cents: priceCents,
      };
      const url = editingService
        ? `/api/v1/services/${editingService.id}`
        : "/api/v1/services";
      const method = editingService ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const errBody = (await res.json()) as { error?: string };
        setSvcError(errBody.error ?? "Erreur");
        toast.error("Erreur lors de la sauvegarde du service");
        return;
      }

      const savedService = await res.json();
      const serviceId = editingService?.id ?? savedService.data?.id ?? savedService.id;

      // Update practitioner-service assignments
      if (serviceId) {
        for (const prac of practitioners) {
          const wasLinked = prac.service_ids.includes(serviceId);
          const shouldBeLinked = svcPracIds.includes(prac.id);
          if (wasLinked !== shouldBeLinked) {
            const newServiceIds = shouldBeLinked
              ? [...prac.service_ids, serviceId]
              : prac.service_ids.filter((sid) => sid !== serviceId);
            await fetch(`/api/v1/practitioners/${prac.id}/services`, {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ service_ids: newServiceIds }),
            });
          }
        }
      }

      setDialogOpen(false);
      toast.success(editingService ? "Service modifié" : "Service créé");
      fetchData();
    } finally {
      setSvcSaving(false);
    }
  };

  // ---- Horaires save ----

  const handleSaveSchedule = async () => {
    setScheduleSaving(true);
    try {
      const promises = Object.entries(scheduleByPrac).map(([pracId, days]) => {
        const recurring = days.map((slot, i) => ({
          day_of_week: i,
          start_time: slot.start,
          end_time: slot.end,
          is_available: slot.enabled,
        }));
        const exceptions = (vacationByPrac[pracId] ?? []).map((date) => ({
          exception_date: date,
          start_time: "00:00",
          end_time: "23:59",
          is_available: false,
        }));
        return fetch(`/api/v1/practitioners/${pracId}/availability`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ recurring, exceptions }),
        });
      });
      const results = await Promise.all(promises);
      const failed = results.some((r) => !r.ok);
      if (failed) {
        toast.error("Erreur lors de la sauvegarde de certains horaires");
      } else {
        toast.success("Horaires sauvegardés");
      }
      fetchData();
    } finally {
      setScheduleSaving(false);
    }
  };

  const activeServices = useMemo(() => services.filter((s) => s.is_active), [services]);
  const activePractitioners = useMemo(() => practitioners.filter((p) => p.is_active), [practitioners]);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Services</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {activeServices.length} service{activeServices.length > 1 ? "s" : ""} &middot;{" "}
            {activePractitioners.length} praticien{activePractitioners.length > 1 ? "s" : ""}
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200 mb-6">
        {TABS.map((t) => (
          <button
            key={t.value}
            onClick={() => setTab(t.value)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
              tab === t.value
                ? "border-indigo-600 text-indigo-600"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            {t.icon}
            {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <>
          {/* Barre d'action — même style pour tous les onglets */}
          <div className="flex justify-end mb-4">
            {tab === "services" && (
              <Button onClick={openNewService} className="gap-2">
                <Plus className="h-4 w-4" />
                Nouveau service
              </Button>
            )}
            {tab === "praticiens" && (
              practitioners.filter((p) => p.is_active).length >= seatCount ? (
                <Button className="gap-2" onClick={() => {
                  sessionStorage.setItem("settings_tab", "abonnement");
                  window.location.href = "/settings";
                }}>
                  <ArrowUpCircle className="h-4 w-4" />
                  Upgrader mon forfait
                </Button>
              ) : null
            )}
            {tab === "horaires" && (
              <Button
                onClick={handleSaveSchedule}
                disabled={scheduleSaving}
                className="gap-2"
              >
                <Save className="h-4 w-4" />
                {scheduleSaving ? "Enregistrement..." : "Sauvegarder les horaires"}
              </Button>
            )}
            {tab === "fermetures" && (
              <Button className="gap-2">
                <Plus className="h-4 w-4" />
                Ajouter fermeture
              </Button>
            )}
          </div>

          {/* ---- Onglet Services ---- */}
          {tab === "services" && (
            <div className="space-y-3">
              {services.length === 0 && (
                <p className="text-center text-gray-400 py-12 italic">
                  Aucun service. Créez votre premier service pour commencer.
                </p>
              )}
              {services.map((svc) => {
                const assignedPracs = practitioners.filter((p) =>
                  svc.practitioner_ids.includes(p.id),
                );
                return (
                  <div
                    key={svc.id}
                    className={`group flex items-center gap-4 rounded-xl border border-gray-100 bg-white px-4 py-3 hover:shadow-sm transition-shadow ${
                      !svc.is_active ? "opacity-50" : ""
                    }`}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-gray-900">{svc.name}</span>
                        {!svc.is_active && (
                          <span className="text-xs bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded">
                            Inactif
                          </span>
                        )}
                      </div>
                      {svc.description && (
                        <p className="text-xs text-gray-400 truncate mt-0.5">{svc.description}</p>
                      )}
                    </div>
                    <span className="text-sm text-gray-500 whitespace-nowrap">
                      {formatDuration(svc.duration_minutes)}
                    </span>
                    <span className="text-sm font-semibold text-gray-800 whitespace-nowrap">
                      {formatPrice(svc.price_cents)}
                    </span>
                    <div className="flex flex-wrap gap-1">
                      {assignedPracs.map((p) => (
                        <span
                          key={p.id}
                          className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium text-white"
                          style={{ backgroundColor: p.color }}
                        >
                          {p.name}
                        </span>
                      ))}
                      {assignedPracs.length === 0 && (
                        <span className="text-xs text-gray-400 italic">Aucun praticien</span>
                      )}
                    </div>
                    <div className="hidden group-hover:flex gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => openEditService(svc)}
                        aria-label="Modifier"
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      {svc.is_active && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setDeleteTarget(svc)}
                          aria-label="Désactiver"
                        >
                          <Trash2 className="h-4 w-4 text-red-500" />
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* ---- Onglet Praticiens ---- */}
          {tab === "praticiens" && (
            <PractitionerManager
              practitioners={practitioners}
              services={services}
              seatCount={seatCount}
              onUpdate={fetchData}
            />
          )}

          {/* ---- Onglet Horaires ---- */}
          {tab === "horaires" && (
            <div className="space-y-6">
              {activePractitioners.map((prac) => {
                const days = scheduleByPrac[prac.id];
                if (!days) return null;
                const pracVacations = vacationByPrac[prac.id] ?? [];
                const vacInput = vacationInputs[prac.id] ?? { from: "", to: "" };

                // Group consecutive vacation dates into ranges for display
                const vacationRanges: { from: string; to: string }[] = [];
                for (let vi = 0; vi < pracVacations.length; vi++) {
                  const rangeStart = pracVacations[vi];
                  let rangeEnd = rangeStart;
                  while (vi + 1 < pracVacations.length) {
                    const next = new Date(pracVacations[vi + 1]);
                    const curr = new Date(rangeEnd);
                    curr.setDate(curr.getDate() + 1);
                    if (next.toISOString().slice(0, 10) === curr.toISOString().slice(0, 10)) {
                      rangeEnd = pracVacations[vi + 1];
                      vi++;
                    } else break;
                  }
                  vacationRanges.push({ from: rangeStart, to: rangeEnd });
                }

                const BREAK_DURATIONS = [
                  { value: 0, label: "Pas de pause" },
                  { value: 30, label: "30 min" },
                  { value: 45, label: "45 min" },
                  { value: 60, label: "1h" },
                  { value: 90, label: "1h30" },
                  { value: 120, label: "2h" },
                ];

                return (
                  <Card key={prac.id}>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 text-base">
                        <span
                          className="h-3 w-3 rounded-full"
                          style={{ backgroundColor: prac.color }}
                        />
                        {prac.name}
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="flex gap-4">
                        {/* Colonne gauche : Horaires */}
                        <div className="flex-1 min-w-0 space-y-2 overflow-x-auto">
                          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Horaires de travail</p>
                          {DAY_LABELS.map((day, i) => {
                            const breakMinutes = (() => {
                              const bs = days[i].breakStart.split(":").map(Number);
                              const be = days[i].breakEnd.split(":").map(Number);
                              return (be[0] * 60 + be[1]) - (bs[0] * 60 + bs[1]);
                            })();
                            return (
                              <div key={day} className="flex items-center gap-2">
                                <label className="flex items-center gap-2 w-24 text-sm cursor-pointer shrink-0">
                                  <input
                                    type="checkbox"
                                    checked={days[i].enabled}
                                    onChange={() =>
                                      setScheduleByPrac((prev) => ({
                                        ...prev,
                                        [prac.id]: prev[prac.id].map((slot, j) =>
                                          j === i ? { ...slot, enabled: !slot.enabled } : slot,
                                        ),
                                      }))
                                    }
                                    className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                                  />
                                  <span className={days[i].enabled ? "text-gray-900 font-medium" : "text-gray-400"}>
                                    {day}
                                  </span>
                                </label>
                                {days[i].enabled ? (
                                  <div className="flex items-center gap-1.5 text-sm">
                                    {/* Horaires de travail */}
                                    <input
                                      type="time"
                                      value={days[i].start}
                                      onChange={(e) =>
                                        setScheduleByPrac((prev) => ({
                                          ...prev,
                                          [prac.id]: prev[prac.id].map((slot, j) =>
                                            j === i ? { ...slot, start: e.target.value } : slot,
                                          ),
                                        }))
                                      }
                                      className="border border-gray-200 rounded px-2 py-1 text-sm"
                                    />
                                    <span className="text-gray-400">—</span>
                                    <input
                                      type="time"
                                      value={days[i].end}
                                      onChange={(e) =>
                                        setScheduleByPrac((prev) => ({
                                          ...prev,
                                          [prac.id]: prev[prac.id].map((slot, j) =>
                                            j === i ? { ...slot, end: e.target.value } : slot,
                                          ),
                                        }))
                                      }
                                      className="border border-gray-200 rounded px-2 py-1 text-sm"
                                    />
                                    {/* Pause : début + durée */}
                                    <div className="flex items-center gap-1 ml-2 pl-2 border-l border-gray-200">
                                      <span className="text-xs text-amber-600 font-medium">Pause</span>
                                      <input
                                        type="time"
                                        value={days[i].breakStart}
                                        onChange={(e) =>
                                          setScheduleByPrac((prev) => ({
                                            ...prev,
                                            [prac.id]: prev[prac.id].map((slot, j) =>
                                              j === i ? { ...slot, breakStart: e.target.value } : slot,
                                            ),
                                          }))
                                        }
                                        className="border border-amber-200 bg-amber-50 rounded px-1.5 py-1 text-xs w-[76px]"
                                      />
                                      <select
                                        value={breakMinutes}
                                        onChange={(e) => {
                                          const dur = Number(e.target.value);
                                          const bs = days[i].breakStart.split(":").map(Number);
                                          const endMin = bs[0] * 60 + bs[1] + dur;
                                          const endH = String(Math.floor(endMin / 60)).padStart(2, "0");
                                          const endM = String(endMin % 60).padStart(2, "0");
                                          setScheduleByPrac((prev) => ({
                                            ...prev,
                                            [prac.id]: prev[prac.id].map((slot, j) =>
                                              j === i ? { ...slot, breakEnd: `${endH}:${endM}` } : slot,
                                            ),
                                          }));
                                        }}
                                        className="border border-amber-200 bg-amber-50 rounded px-1 py-1 text-xs"
                                      >
                                        {BREAK_DURATIONS.map((bd) => (
                                          <option key={bd.value} value={bd.value}>{bd.label}</option>
                                        ))}
                                      </select>
                                    </div>
                                  </div>
                                ) : (
                                  <span className="text-xs text-gray-400 italic">Fermé</span>
                                )}
                              </div>
                            );
                          })}
                        </div>

                        {/* Colonne droite : Congés */}
                        <div className="w-64 shrink-0 border-l pl-4">
                          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2 flex items-center gap-1">
                            <CalendarOff className="h-3.5 w-3.5" />
                            Congés
                          </p>
                          <div className="space-y-2 mb-3">
                            <div className="flex items-center gap-1.5">
                              <span className="text-xs text-gray-500">Du</span>
                              <input
                                type="date"
                                value={vacInput.from}
                                onChange={(e) => setVacationInputs((prev) => ({ ...prev, [prac.id]: { ...vacInput, from: e.target.value } }))}
                                className="border border-gray-200 rounded px-2 py-1 text-xs flex-1"
                              />
                            </div>
                            <div className="flex items-center gap-1.5">
                              <span className="text-xs text-gray-500">Au</span>
                              <input
                                type="date"
                                value={vacInput.to}
                                onChange={(e) => setVacationInputs((prev) => ({ ...prev, [prac.id]: { ...vacInput, to: e.target.value } }))}
                                className="border border-gray-200 rounded px-2 py-1 text-xs flex-1"
                              />
                            </div>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="w-full"
                              disabled={!vacInput.from || !vacInput.to || vacInput.from > vacInput.to}
                              onClick={() => {
                                const dates: string[] = [];
                                const d = new Date(vacInput.from);
                                const end = new Date(vacInput.to);
                                while (d <= end) {
                                  const iso = d.toISOString().slice(0, 10);
                                  if (!pracVacations.includes(iso)) dates.push(iso);
                                  d.setDate(d.getDate() + 1);
                                }
                                setVacationByPrac((prev) => ({
                                  ...prev,
                                  [prac.id]: [...(prev[prac.id] ?? []), ...dates].sort(),
                                }));
                                setVacationInputs((prev) => ({ ...prev, [prac.id]: { from: "", to: "" } }));
                              }}
                            >
                              Ajouter
                            </Button>
                          </div>
                          {vacationRanges.length > 0 ? (
                            <div className="space-y-1">
                              {vacationRanges.map((r) => {
                                const fromDate = new Date(r.from);
                                const toDate = new Date(r.to);
                                const isSingle = r.from === r.to;
                                const label = isSingle
                                  ? fromDate.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "short", year: "numeric" })
                                  : `${fromDate.toLocaleDateString("fr-FR", { weekday: "short", day: "numeric" })} au ${toDate.toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short", year: "numeric" })}`;
                                return (
                                  <div key={r.from} className="flex items-center justify-between text-xs bg-red-50 text-red-700 px-2 py-1.5 rounded border border-red-200">
                                    <span>{isSingle ? label : `Du ${label}`}</span>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        const d = new Date(r.from);
                                        const end = new Date(r.to);
                                        const toRemove: string[] = [];
                                        while (d <= end) {
                                          toRemove.push(d.toISOString().slice(0, 10));
                                          d.setDate(d.getDate() + 1);
                                        }
                                        setVacationByPrac((prev) => ({
                                          ...prev,
                                          [prac.id]: (prev[prac.id] ?? []).filter((v) => !toRemove.includes(v)),
                                        }));
                                      }}
                                      className="hover:text-red-900 ml-2"
                                    >
                                      ×
                                    </button>
                                  </div>
                                );
                              })}
                            </div>
                          ) : (
                            <p className="text-xs text-gray-400 italic">Aucun congé planifié</p>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}

          {/* ---- Onglet Fermetures ---- */}
          {tab === "fermetures" && (
            <div>
              <Card>
                <CardContent className="py-12 text-center">
                  <CalendarOff className="h-8 w-8 text-gray-300 mx-auto mb-3" />
                  <p className="text-sm text-gray-500">
                    Aucune fermeture exceptionnelle configurée.
                  </p>
                  <p className="text-xs text-gray-400 mt-1">
                    Les jours de fermeture bloquent la prise de RDV par l&apos;IA.
                  </p>
                </CardContent>
              </Card>
            </div>
          )}
        </>
      )}

      {/* Dialog Service */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingService ? "Modifier le service" : "Nouveau service"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Nom <span className="text-red-500">*</span>
              </label>
              <Input
                value={svcName}
                onChange={(e) => setSvcName(e.target.value)}
                placeholder="Coupe homme, Coloration..."
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Description
              </label>
              <textarea
                value={svcDesc}
                onChange={(e) => setSvcDesc(e.target.value)}
                rows={2}
                className="w-full text-sm border border-gray-200 rounded-lg p-2 resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="Description optionnelle..."
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Durée</label>
                <select
                  value={svcDuration}
                  onChange={(e) => setSvcDuration(Number(e.target.value))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  {DURATION_OPTIONS.map((d) => (
                    <option key={d} value={d}>
                      {formatDuration(d)}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Prix (€)</label>
                <Input
                  value={svcPriceEuros}
                  onChange={(e) => setSvcPriceEuros(e.target.value)}
                  placeholder="25.00"
                  type="text"
                  inputMode="decimal"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Praticiens assignés
              </label>
              <div className="grid grid-cols-2 gap-2">
                {activePractitioners.map((p) => (
                  <label key={p.id} className="flex items-center gap-2 text-sm cursor-pointer">
                    <input
                      type="checkbox"
                      checked={svcPracIds.includes(p.id)}
                      onChange={() =>
                        setSvcPracIds((prev) =>
                          prev.includes(p.id)
                            ? prev.filter((x) => x !== p.id)
                            : [...prev, p.id],
                        )
                      }
                      className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                    />
                    <span
                      className="h-3 w-3 rounded-full"
                      style={{ backgroundColor: p.color }}
                    />
                    <span>{p.name}</span>
                  </label>
                ))}
              </div>
            </div>
            {svcError && (
              <p className="text-sm text-red-600 bg-red-50 p-2 rounded border border-red-100">
                {svcError}
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Annuler
            </Button>
            <Button
              onClick={handleSaveService}
              disabled={svcSaving || svcName.trim().length < 2}
            >
              {svcSaving ? "Enregistrement..." : "Sauvegarder"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog confirmation suppression */}
      <Dialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Désactiver le service</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-gray-600">
            Voulez-vous vraiment désactiver <strong>{deleteTarget?.name}</strong> ? Il ne sera plus proposé à la réservation.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              Annuler
            </Button>
            <Button variant="destructive" onClick={confirmDeleteService}>
              Désactiver
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ServicesContent;
