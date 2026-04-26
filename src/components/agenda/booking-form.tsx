"use client";

import { useReducer, useMemo, useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog";
import { X, Search, Plus, Sparkles, Scissors, Clock } from "lucide-react";
import type { Practitioner, Service, Client, Booking } from "@/types/supabase";
import { getBookingColor } from "@/lib/agenda/colors";

interface BookingWithDetails extends Booking {
  client: { id: string; name: string | null; phone: string | null; preferred_language: string; notes: string | null; loyalty_tier: string; loyalty_points: number } | null;
  practitioner: { id: string; name: string; color: string } | null;
  service: { id: string; name: string; duration_minutes: number; price_cents: number } | null;
}

interface PractitionerWithServiceIds extends Practitioner {
  service_ids?: string[];
  availability?: { day_of_week: number; start_time: string; end_time: string; is_available: boolean; exception_date: string | null; break_start?: string | null; break_end?: string | null }[];
}

interface CreateBookingData {
  client_id: string;
  practitioner_id: string;
  service_id: string;
  starts_at: string;
  ends_at: string;
  source_channel: "dashboard";
}

interface BookingFormProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: CreateBookingData) => void | Promise<void>;
  onClientCreated?: () => void;
  initialDate?: Date;
  initialPractitionerId?: string;
  editBooking?: BookingWithDetails;
  practitioners: PractitionerWithServiceIds[];
  services: Service[];
  clients: Client[];
}

// ---------- helpers ----------

const computeEndsAt = (start: string, durationMinutes: number): string => {
  const d = new Date(start);
  d.setMinutes(d.getMinutes() + durationMinutes);
  return d.toISOString();
};

const getInitials = (name: string): string =>
  name.split(/\s+/).map((w) => w[0]).filter(Boolean).join("").slice(0, 2).toUpperCase();

const generateTimeSlots = (startHour: number, endHour: number): string[] => {
  const slots: string[] = [];
  for (let h = startHour; h < endHour; h++) {
    for (const m of [0, 15, 30, 45]) slots.push(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`);
  }
  return slots;
};

const toDateValue = (d: Date): string => {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};
const toTimeValue = (d: Date): string => {
  const m = Math.round(d.getMinutes() / 15) * 15;
  const h = d.getHours() + Math.floor(m / 60);
  return `${String(h).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
};

// ---------- form state ----------

interface FormState {
  clientId: string;
  practitionerId: string;
  serviceId: string;
  startDate: string;
  startTime: string;
  errors: Partial<Record<string, string>>;
}

type FormAction =
  | { type: "SET_FIELD"; field: keyof Omit<FormState, "errors">; value: string }
  | { type: "SET_ERRORS"; errors: Partial<Record<string, string>> }
  | { type: "RESET"; payload: Omit<FormState, "errors"> };

const formReducer = (state: FormState, action: FormAction): FormState => {
  switch (action.type) {
    case "SET_FIELD":
      return { ...state, [action.field]: action.value, errors: { ...state.errors, [action.field]: undefined } };
    case "SET_ERRORS":
      return { ...state, errors: action.errors };
    case "RESET":
      return { ...action.payload, errors: {} };
    default:
      return state;
  }
};

const buildInitialState = (
  editBooking: BookingWithDetails | undefined,
  initialDate: Date | undefined,
  initialPractitionerId: string | undefined,
): FormState => {
  if (editBooking) {
    const d = new Date(editBooking.starts_at);
    return {
      clientId: editBooking.client_id,
      practitionerId: editBooking.practitioner_id,
      serviceId: editBooking.service_id,
      startDate: toDateValue(d),
      startTime: toTimeValue(d),
      errors: {},
    };
  }
  const base = initialDate ? new Date(initialDate) : new Date();
  base.setSeconds(0, 0);
  return {
    clientId: "",
    practitionerId: initialPractitionerId ?? "",
    serviceId: "",
    startDate: toDateValue(base),
    startTime: toTimeValue(base),
    errors: {},
  };
};

// ---------- component ----------

const BookingForm = ({
  open,
  onClose,
  onSubmit,
  onClientCreated,
  initialDate,
  initialPractitionerId,
  editBooking,
  practitioners,
  services,
  clients,
}: BookingFormProps) => {
  const [state, dispatch] = useReducer(
    formReducer,
    undefined,
    () => buildInitialState(editBooking, initialDate, initialPractitionerId),
  );
  const { clientId, practitionerId, serviceId, startDate, startTime, errors } = state;

  const [submitting, setSubmitting] = useState(false);
  const [clientQuery, setClientQuery] = useState("");
  const [serviceQuery, setServiceQuery] = useState("");
  const [showNewClient, setShowNewClient] = useState(false);
  const [newClientName, setNewClientName] = useState("");
  const [newClientPhone, setNewClientPhone] = useState("");
  const [creatingClient, setCreatingClient] = useState(false);

  // Reset interne quand initialPractitionerId change (clic sur colonne)
  useEffect(() => {
    if (initialPractitionerId && open && !editBooking) {
      dispatch({ type: "SET_FIELD", field: "practitionerId", value: initialPractitionerId });
    }
  }, [initialPractitionerId, open, editBooking]);

  const selectedService = useMemo(
    () => services.find((s) => s.id === serviceId),
    [services, serviceId]
  );
  const selectedClient = useMemo(
    () => clients.find((c) => c.id === clientId),
    [clients, clientId]
  );
  const activeServices = useMemo(
    () => services.filter((s) => s.is_active),
    [services]
  );

  const filteredClients = useMemo(() => {
    if (!clientQuery.trim()) return [];
    const q = clientQuery.toLowerCase();
    return clients
      .filter((c) =>
        (c.name?.toLowerCase().includes(q) ?? false) ||
        (c.phone?.includes(q) ?? false)
      )
      .slice(0, 8);
  }, [clients, clientQuery]);

  const filteredServices = useMemo(() => {
    if (!serviceQuery.trim()) return activeServices;
    const q = serviceQuery.toLowerCase();
    return activeServices.filter((s) => s.name.toLowerCase().includes(q));
  }, [activeServices, serviceQuery]);

  const filteredPractitioners = useMemo(() => {
    const active = practitioners.filter((p) => p.is_active);
    if (!serviceId) return active;
    const linked = active.filter((p) => p.service_ids && p.service_ids.includes(serviceId));
    return linked.length > 0 ? linked : active;
  }, [practitioners, serviceId]);

  // Auto-select practitioner if only one matches
  useEffect(() => {
    if (serviceId && filteredPractitioners.length === 1 && practitionerId !== filteredPractitioners[0].id) {
      dispatch({ type: "SET_FIELD", field: "practitionerId", value: filteredPractitioners[0].id });
    }
  }, [serviceId, filteredPractitioners, practitionerId]);

  // Practitioner availability for selected day
  const pracAvailability = useMemo(() => {
    if (!practitionerId || !startDate) return { works: true, dayAvail: null as null | { start_time: string; end_time: string; break_start?: string | null; break_end?: string | null } };
    const selectedPrac = practitioners.find((p) => p.id === practitionerId);
    if (!selectedPrac?.availability) return { works: true, dayAvail: null };
    const dayOfWeek = (new Date(startDate).getDay() + 6) % 7;
    const isVacation = selectedPrac.availability.some(
      (a) => a.exception_date === startDate && !a.is_available
    );
    if (isVacation) return { works: false, dayAvail: null, reason: "en congé ce jour" };
    const dayAvail = selectedPrac.availability.find(
      (a) => a.day_of_week === dayOfWeek && a.exception_date === null
    );
    if (dayAvail && !dayAvail.is_available) return { works: false, dayAvail: null, reason: "ne travaille pas ce jour" };
    return { works: true, dayAvail: dayAvail ?? null };
  }, [practitioners, practitionerId, startDate]);

  const timeSlots = useMemo(() => {
    if (!pracAvailability.works) return [];
    let startH = 8;
    let endH = 20;
    if (pracAvailability.dayAvail) {
      startH = parseInt(pracAvailability.dayAvail.start_time.slice(0, 2));
      const endParsed = parseInt(pracAvailability.dayAvail.end_time.slice(0, 2)) +
        (parseInt(pracAvailability.dayAvail.end_time.slice(3, 5)) > 0 ? 1 : 0);
      endH = endParsed;
    }
    const breakStartStr = pracAvailability.dayAvail?.break_start ?? "12:00";
    const breakEndStr = pracAvailability.dayAvail?.break_end ?? "13:00";
    const [bsH, bsM] = breakStartStr.slice(0, 5).split(":").map(Number);
    const [beH, beM] = breakEndStr.slice(0, 5).split(":").map(Number);
    const breakStartMins = bsH * 60 + bsM;
    const breakEndMins = beH * 60 + beM;
    if (breakStartMins >= breakEndMins) return generateTimeSlots(startH, endH);
    return generateTimeSlots(startH, endH).filter((t) => {
      const [h, m] = t.split(":").map(Number);
      const mins = h * 60 + m;
      return mins < breakStartMins || mins >= breakEndMins;
    });
  }, [pracAvailability]);

  // Date tabs : Aujourd'hui / Demain / Après-demain
  const dateTabs = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return [0, 1, 2].map((offset) => {
      const d = new Date(today);
      d.setDate(today.getDate() + offset);
      const label = offset === 0 ? "Aujourd'hui" : offset === 1 ? "Demain" : d.toLocaleDateString("fr-FR", { weekday: "short" }).replace(".", "");
      return { value: toDateValue(d), label, capitalLabel: label.charAt(0).toUpperCase() + label.slice(1) };
    });
  }, []);

  // Step calculation pour stepper visuel
  const currentStep = !clientId ? 1 : !serviceId ? 2 : 3;

  const handleCreateClient = async () => {
    if (!newClientName.trim()) return;
    setCreatingClient(true);
    const res = await fetch("/api/v1/clients", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: newClientName.trim(),
        phone: newClientPhone.trim() || null,
      }),
    });
    setCreatingClient(false);
    if (res.ok) {
      const json = await res.json();
      const newId = json.data?.id ?? json.id;
      if (newId) dispatch({ type: "SET_FIELD", field: "clientId", value: newId });
      setShowNewClient(false);
      setNewClientName("");
      setNewClientPhone("");
      setClientQuery("");
      onClientCreated?.();
    }
  };

  const startDatetime = `${startDate}T${startTime}`;

  const validate = (): boolean => {
    const newErrors: Partial<Record<string, string>> = {};
    if (!clientId) newErrors.clientId = "Veuillez sélectionner un client.";
    if (!practitionerId) newErrors.practitionerId = "Veuillez sélectionner un praticien.";
    if (!serviceId) newErrors.serviceId = "Veuillez sélectionner un service.";
    if (!startDate) newErrors.startDate = "Veuillez indiquer une date.";
    if (!startTime) newErrors.startTime = "Veuillez indiquer une heure.";
    if (practitionerId && startDate && !pracAvailability.works) {
      const pracName = practitioners.find((p) => p.id === practitionerId)?.name ?? "Ce praticien";
      newErrors.startDate = `${pracName} ${pracAvailability.reason ?? "n'est pas disponible ce jour"}.`;
    }
    if (startTime && pracAvailability.dayAvail) {
      const bs = pracAvailability.dayAvail.break_start ?? "12:00";
      const be = pracAvailability.dayAvail.break_end ?? "13:00";
      const [bsH, bsM] = bs.slice(0, 5).split(":").map(Number);
      const [beH, beM] = be.slice(0, 5).split(":").map(Number);
      const breakStartMins = bsH * 60 + bsM;
      const breakEndMins = beH * 60 + beM;
      const [sh, sm] = startTime.split(":").map(Number);
      const startMins = sh * 60 + sm;
      if (breakStartMins < breakEndMins && startMins >= breakStartMins && startMins < breakEndMins) {
        newErrors.startTime = `Ce créneau est pendant la pause (${bs.slice(0,5)}-${be.slice(0,5)}).`;
      }
    }
    if (startDate && startTime && !newErrors.startDate && !newErrors.startTime) {
      const selected = new Date(`${startDate}T${startTime}`);
      if (selected < new Date()) newErrors.startTime = "Impossible de réserver dans le passé.";
    }
    dispatch({ type: "SET_ERRORS", errors: newErrors });
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!validate()) return;
    const duration = selectedService?.duration_minutes ?? 60;
    const starts_at = new Date(startDatetime).toISOString();
    const ends_at = computeEndsAt(startDatetime, duration);
    setSubmitting(true);
    try {
      await onSubmit({
        client_id: clientId,
        practitioner_id: practitionerId,
        service_id: serviceId,
        starts_at,
        ends_at,
        source_channel: "dashboard",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const isComplete = clientId && serviceId && practitionerId && startDate && startTime;

  // Couleur de service par catégorie (pour les cartes prestation)
  const serviceColor = (s: Service): string =>
    getBookingColor(
      { status: "confirmed", practitioner: null, service: { name: s.name } },
      "service",
      "#64748b"
    );

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent
        showCloseButton={false}
        className="max-w-md p-0 gap-0 overflow-hidden flex flex-col"
        style={{ maxHeight: "92vh" }}
      >
        {/* Header — proto */}
        <div
          className="flex items-center justify-between px-5 py-4"
          style={{ borderBottom: "1px solid var(--agenda-border)" }}
        >
          <h2 className="text-[18px] font-bold tracking-[-0.01em]" style={{ color: "var(--agenda-fg)" }}>
            {editBooking ? "Modifier le rendez-vous" : "Nouveau rendez-vous"}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center justify-center w-8 h-8 rounded-lg transition-colors"
            style={{ color: "var(--agenda-fg-muted)" }}
            onMouseEnter={(e) => { e.currentTarget.style.background = "var(--agenda-surface-3)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
            aria-label="Fermer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Stepper — 3 étapes */}
        <div
          className="flex items-stretch px-5 pt-3"
          style={{ borderBottom: "1px solid var(--agenda-border)" }}
        >
          {[
            { n: "01", label: "Client", complete: !!clientId },
            { n: "02", label: "Prestation", complete: !!serviceId },
            { n: "03", label: "Créneau", complete: !!practitionerId && !!startDate && !!startTime },
          ].map((step, i) => {
            const stepNum = i + 1;
            const isActive = currentStep === stepNum;
            return (
              <div
                key={step.n}
                className="flex-1 pb-2.5 text-[12px]"
                style={{
                  borderBottom: isActive ? `2px solid var(--agenda-brand)` : "2px solid transparent",
                  color: step.complete || isActive ? "var(--agenda-fg)" : "var(--agenda-fg-subtle)",
                  fontWeight: isActive ? 600 : 500,
                }}
              >
                <span style={{ color: "var(--agenda-fg-subtle)" }}>{step.n}</span>{" "}
                <span>{step.label}</span>
              </div>
            );
          })}
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col overflow-y-auto flex-1">
          <div className="px-5 py-4 flex flex-col gap-5">

            {/* ───── 01 CLIENT ───── */}
            <section className="flex flex-col gap-2">
              <h3 className="text-[10px] font-bold uppercase tracking-[0.08em] flex items-center gap-1.5" style={{ color: "var(--agenda-fg-subtle)" }}>
                <Sparkles className="w-3 h-3" /> Client
              </h3>
              {selectedClient && !showNewClient ? (
                <button
                  type="button"
                  onClick={() => dispatch({ type: "SET_FIELD", field: "clientId", value: "" })}
                  className="flex items-center gap-2.5 px-3 py-2.5 rounded-[10px] text-left"
                  style={{ background: "var(--agenda-surface-3)", border: "1px solid var(--agenda-border)" }}
                >
                  <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-[11px] font-bold text-gray-600">
                    {getInitials(selectedClient.name ?? "?")}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] font-semibold truncate" style={{ color: "var(--agenda-fg)" }}>
                      {selectedClient.name ?? "Client"}
                    </div>
                    {selectedClient.phone && (
                      <div className="text-[11px] truncate" style={{ color: "var(--agenda-fg-muted)" }}>
                        {selectedClient.phone}
                      </div>
                    )}
                  </div>
                  <X className="w-3.5 h-3.5 opacity-50" />
                </button>
              ) : showNewClient ? (
                <div className="space-y-2 rounded-[10px] p-3" style={{ background: "var(--agenda-surface-3)", border: "1px solid var(--agenda-border)" }}>
                  <input
                    placeholder="Nom du client *"
                    value={newClientName}
                    onChange={(e) => setNewClientName(e.target.value)}
                    className="w-full h-9 px-3 rounded-md text-[13px] outline-none focus:ring-2"
                    style={{ background: "white", border: "1px solid var(--agenda-border)" }}
                  />
                  <input
                    placeholder="Téléphone"
                    value={newClientPhone}
                    onChange={(e) => setNewClientPhone(e.target.value)}
                    className="w-full h-9 px-3 rounded-md text-[13px] outline-none focus:ring-2"
                    style={{ background: "white", border: "1px solid var(--agenda-border)" }}
                  />
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => { setShowNewClient(false); setNewClientName(""); setNewClientPhone(""); }}
                      className="px-3 py-1.5 text-[12px] font-medium rounded-md"
                      style={{ background: "white", border: "1px solid var(--agenda-border)", color: "var(--agenda-fg-muted)" }}
                    >
                      Annuler
                    </button>
                    <button
                      type="button"
                      onClick={handleCreateClient}
                      disabled={!newClientName.trim() || creatingClient}
                      className="flex-1 px-3 py-1.5 text-[12px] font-semibold text-white rounded-md disabled:opacity-50"
                      style={{ background: "var(--agenda-brand)" }}
                    >
                      {creatingClient ? "Création..." : "Ajouter"}
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: "var(--agenda-fg-subtle)" }} />
                    <input
                      type="text"
                      value={clientQuery}
                      onChange={(e) => setClientQuery(e.target.value)}
                      placeholder="Rechercher un client par nom ou téléphone…"
                      className="w-full h-10 pl-9 pr-3 rounded-[10px] text-[13px] outline-none focus:ring-2"
                      style={{
                        background: "var(--agenda-surface)",
                        border: "1px solid var(--agenda-border)",
                        color: "var(--agenda-fg)",
                      }}
                    />
                  </div>
                  {filteredClients.length > 0 && (
                    <div className="rounded-[10px] divide-y overflow-hidden" style={{ background: "var(--agenda-surface)", border: "1px solid var(--agenda-border)", borderColor: "var(--agenda-border)" }}>
                      {filteredClients.map((c) => (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => { dispatch({ type: "SET_FIELD", field: "clientId", value: c.id }); setClientQuery(""); }}
                          className="w-full flex items-center gap-2.5 px-3 py-2 text-left transition-colors"
                          onMouseEnter={(e) => { e.currentTarget.style.background = "var(--agenda-surface-3)"; }}
                          onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
                        >
                          <div className="w-7 h-7 rounded-full bg-gray-200 flex items-center justify-center text-[10px] font-bold text-gray-600">
                            {getInitials(c.name ?? "?")}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-[13px] truncate" style={{ color: "var(--agenda-fg)" }}>{c.name ?? "Sans nom"}</div>
                            {c.phone && (
                              <div className="text-[11px] truncate" style={{ color: "var(--agenda-fg-subtle)" }}>{c.phone}</div>
                            )}
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                  {clientQuery.trim() && filteredClients.length === 0 && (
                    <button
                      type="button"
                      onClick={() => { setShowNewClient(true); setNewClientName(clientQuery); }}
                      className="flex items-center gap-2.5 px-3 py-2.5 rounded-[10px] text-left transition-colors"
                      style={{ background: "var(--agenda-surface-3)", border: "1px solid var(--agenda-border)" }}
                    >
                      <div className="w-7 h-7 rounded-full flex items-center justify-center" style={{ background: "var(--agenda-brand-soft)" }}>
                        <Plus className="w-3.5 h-3.5" style={{ color: "var(--agenda-brand)" }} />
                      </div>
                      <div>
                        <div className="text-[13px] font-medium" style={{ color: "var(--agenda-fg)" }}>
                          Créer un nouveau client « {clientQuery} »
                        </div>
                        <div className="text-[11px]" style={{ color: "var(--agenda-fg-subtle)" }}>
                          1 champ requis : téléphone
                        </div>
                      </div>
                    </button>
                  )}

                  {/* Liste déroulante : sélection rapide parmi tous les clients */}
                  <select
                    value={clientId}
                    onChange={(e) => {
                      dispatch({ type: "SET_FIELD", field: "clientId", value: e.target.value });
                      setClientQuery("");
                    }}
                    className="w-full h-9 px-3 rounded-[8px] text-[13px] outline-none focus:ring-2"
                    style={{
                      background: "var(--agenda-surface)",
                      border: "1px solid var(--agenda-border)",
                      color: "var(--agenda-fg)",
                    }}
                  >
                    <option value="">— ou choisir dans la liste —</option>
                    {clients.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name ?? "Sans nom"}{c.phone ? ` — ${c.phone}` : ""}
                      </option>
                    ))}
                  </select>
                </>
              )}
              {errors.clientId && <span className="text-[11px] text-red-500">{errors.clientId}</span>}
            </section>

            {/* ───── 02 PRESTATION ───── */}
            <section className="flex flex-col gap-2">
              <h3 className="text-[10px] font-bold uppercase tracking-[0.08em] flex items-center gap-1.5" style={{ color: "var(--agenda-fg-subtle)" }}>
                <Scissors className="w-3 h-3" /> Prestation
              </h3>
              <div className="relative">
                <input
                  type="text"
                  value={serviceQuery}
                  onChange={(e) => setServiceQuery(e.target.value)}
                  placeholder="Rechercher une prestation…"
                  className="w-full h-9 px-3 rounded-[8px] text-[13px] outline-none focus:ring-2"
                  style={{
                    background: "var(--agenda-surface)",
                    border: "1px solid var(--agenda-border)",
                    color: "var(--agenda-fg)",
                  }}
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                {filteredServices.map((s) => {
                  const isSelected = serviceId === s.id;
                  const c = serviceColor(s);
                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => {
                        dispatch({ type: "SET_FIELD", field: "serviceId", value: s.id });
                        if (!initialPractitionerId) dispatch({ type: "SET_FIELD", field: "practitionerId", value: "" });
                      }}
                      className="text-left rounded-[10px] px-2.5 py-2 transition-all"
                      style={{
                        background: isSelected ? `color-mix(in oklch, ${c} 14%, white)` : "var(--agenda-surface)",
                        border: isSelected ? `1.5px solid ${c}` : "1px solid var(--agenda-border)",
                        borderLeft: `4px solid ${c}`,
                      }}
                    >
                      <div className="text-[13px] font-semibold leading-tight" style={{ color: "var(--agenda-fg)" }}>
                        {s.name}
                      </div>
                      <div className="text-[11px] mt-0.5" style={{ color: "var(--agenda-fg-muted)" }}>
                        {s.duration_minutes} min · {(s.price_cents / 100).toFixed(0)}€
                      </div>
                    </button>
                  );
                })}
              </div>
              {errors.serviceId && <span className="text-[11px] text-red-500">{errors.serviceId}</span>}
            </section>

            {/* ───── 03 PRATICIEN & CRÉNEAU ───── */}
            <section className="flex flex-col gap-2">
              <h3 className="text-[10px] font-bold uppercase tracking-[0.08em] flex items-center gap-1.5" style={{ color: "var(--agenda-fg-subtle)" }}>
                <Clock className="w-3 h-3" /> Praticien & créneau
              </h3>

              {/* Pills praticiens */}
              <div className="flex flex-wrap gap-1.5">
                {filteredPractitioners.length > 1 && (
                  <button
                    type="button"
                    onClick={() => dispatch({ type: "SET_FIELD", field: "practitionerId", value: "" })}
                    className="inline-flex items-center gap-1.5 h-8 px-3 rounded-full text-[12px] font-medium transition-colors"
                    style={{
                      background: !practitionerId ? "var(--agenda-brand)" : "var(--agenda-surface)",
                      color: !practitionerId ? "white" : "var(--agenda-fg-muted)",
                      border: !practitionerId ? "1px solid var(--agenda-brand)" : "1px solid var(--agenda-border)",
                    }}
                  >
                    <Sparkles className="w-3 h-3" />
                    Peu importe
                  </button>
                )}
                {filteredPractitioners.map((p) => {
                  const sel = practitionerId === p.id;
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => dispatch({ type: "SET_FIELD", field: "practitionerId", value: p.id })}
                      className="inline-flex items-center gap-1.5 h-8 pl-1 pr-3 rounded-full text-[12px] font-medium transition-all"
                      style={{
                        background: sel ? `color-mix(in oklch, ${p.color} 14%, white)` : "var(--agenda-surface)",
                        border: `1px solid ${sel ? p.color : "var(--agenda-border)"}`,
                        color: sel ? "var(--agenda-fg)" : "var(--agenda-fg-muted)",
                      }}
                    >
                      <span
                        className="rounded-full flex items-center justify-center text-white text-[10px] font-bold"
                        style={{ background: p.color, width: 22, height: 22 }}
                      >
                        {getInitials(p.name)}
                      </span>
                      {p.name}
                    </button>
                  );
                })}
              </div>
              {errors.practitionerId && <span className="text-[11px] text-red-500">{errors.practitionerId}</span>}

              {initialPractitionerId && (
                <div className="rounded-[8px] px-2.5 py-1.5 text-[11px]" style={{ background: "color-mix(in oklch, #10b981 12%, white)", color: "#047857", border: "1px solid color-mix(in oklch, #10b981 25%, white)" }}>
                  ✓ Créneau pré-rempli depuis votre clic sur la grille
                </div>
              )}

              {/* Date tabs */}
              <div className="flex gap-1.5 mt-1">
                {dateTabs.map((tab) => {
                  const sel = startDate === tab.value;
                  return (
                    <button
                      key={tab.value}
                      type="button"
                      onClick={() => dispatch({ type: "SET_FIELD", field: "startDate", value: tab.value })}
                      className="px-3 py-1 rounded-full text-[12px] font-medium transition-colors"
                      style={{
                        background: sel ? "var(--agenda-brand)" : "var(--agenda-surface)",
                        color: sel ? "white" : "var(--agenda-fg-muted)",
                        border: `1px solid ${sel ? "var(--agenda-brand)" : "var(--agenda-border)"}`,
                      }}
                    >
                      {tab.capitalLabel}
                    </button>
                  );
                })}
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => dispatch({ type: "SET_FIELD", field: "startDate", value: e.target.value })}
                  className="ml-auto h-7 px-2 rounded-md text-[12px] outline-none"
                  style={{ border: "1px solid var(--agenda-border)", background: "var(--agenda-surface)", color: "var(--agenda-fg)" }}
                />
              </div>

              {!errors.startDate && practitionerId && startDate && !pracAvailability.works && (
                <div className="rounded-md text-[11px] px-2 py-1.5 mt-1" style={{ background: "color-mix(in oklch, #ef4444 10%, white)", color: "#b91c1c" }}>
                  {practitioners.find((p) => p.id === practitionerId)?.name ?? "Ce praticien"} {pracAvailability.reason ?? "n'est pas disponible ce jour"}.
                </div>
              )}

              {/* Time slot grid */}
              {timeSlots.length > 0 && (
                <>
                  <div className="flex items-center justify-between mt-1">
                    <span className="text-[11px]" style={{ color: "var(--agenda-fg-subtle)" }}>
                      Prochains créneaux libres
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-1.5">
                    {timeSlots.slice(0, 9).map((t) => {
                      const sel = startTime === t;
                      // Heure secondaire = fin si service sélectionné
                      const endLabel = selectedService
                        ? (() => {
                            const [h, m] = t.split(":").map(Number);
                            const end = h * 60 + m + selectedService.duration_minutes;
                            return `${String(Math.floor(end / 60)).padStart(2, "0")}:${String(end % 60).padStart(2, "0")}`;
                          })()
                        : null;
                      return (
                        <button
                          key={t}
                          type="button"
                          onClick={() => dispatch({ type: "SET_FIELD", field: "startTime", value: t })}
                          className="flex flex-col items-center justify-center py-2 rounded-[8px] transition-all"
                          style={{
                            background: sel ? "color-mix(in oklch, var(--agenda-brand) 12%, white)" : "var(--agenda-surface)",
                            border: `1px solid ${sel ? "var(--agenda-brand)" : "var(--agenda-border)"}`,
                          }}
                        >
                          <span className="text-[14px] font-bold leading-none" style={{ color: sel ? "var(--agenda-brand)" : "var(--agenda-fg)" }}>
                            {t}
                          </span>
                          {endLabel && (
                            <span className="text-[10px] mt-0.5" style={{ color: "var(--agenda-fg-subtle)" }}>
                              {endLabel}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </>
              )}
              {errors.startTime && <span className="text-[11px] text-red-500">{errors.startTime}</span>}
            </section>

          </div>

          {/* Footer */}
          <div
            className="flex items-center justify-between gap-2 px-5 py-3"
            style={{ background: "var(--agenda-surface-2)", borderTop: "1px solid var(--agenda-border)" }}
          >
            <span className="text-[11px]" style={{ color: "var(--agenda-fg-subtle)" }}>
              {isComplete ? "Prêt à créer" : "Complétez les étapes pour valider"}
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={onClose}
                disabled={submitting}
                className="px-4 py-2 text-[13px] font-medium rounded-[10px] disabled:opacity-50"
                style={{ background: "transparent", color: "var(--agenda-fg-muted)" }}
              >
                Annuler
              </button>
              <button
                type="submit"
                disabled={submitting || !isComplete}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-[13px] font-semibold text-white rounded-[10px] disabled:opacity-50"
                style={{ background: "var(--agenda-brand)" }}
              >
                ✓ {editBooking ? "Enregistrer" : "Créer le RDV"}
              </button>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default BookingForm;
