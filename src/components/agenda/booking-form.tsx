"use client";

import { useReducer, useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus } from "lucide-react";
import type { Practitioner, Service, Client, Booking } from "@/types/supabase";

interface BookingWithDetails extends Booking {
  client: { id: string; name: string | null; phone: string | null; preferred_language: string; notes: string | null; loyalty_tier: string; loyalty_points: number } | null;
  practitioner: { id: string; name: string; color: string } | null;
  service: { id: string; name: string; duration_minutes: number; price_cents: number } | null;
}

interface PractitionerWithServiceIds extends Practitioner {
  service_ids?: string[];
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

const toDateValue = (d: Date): string => {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

const toTimeValue = (d: Date): string => {
  const m = Math.round(d.getMinutes() / 15) * 15;
  const h = d.getHours() + Math.floor(m / 60);
  return `${String(h).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
};

const buildInitialState = (editBooking: BookingWithDetails | undefined, initialDate: Date | undefined): FormState => {
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
    practitionerId: "",
    serviceId: "",
    startDate: toDateValue(base),
    startTime: toTimeValue(base),
    errors: {},
  };
};

/** Generate 15-min time slots between start and end hours */
const generateTimeSlots = (startHour: number, endHour: number): string[] => {
  const slots: string[] = [];
  for (let h = startHour; h < endHour; h++) {
    for (const m of [0, 15, 30, 45]) {
      slots.push(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`);
    }
  }
  return slots;
};

// ---------- component ----------

const BookingForm = ({
  open,
  onClose,
  onSubmit,
  onClientCreated,
  initialDate,
  editBooking,
  practitioners,
  services,
  clients,
}: BookingFormProps) => {
  const [state, dispatch] = useReducer(
    formReducer,
    undefined,
    () => buildInitialState(editBooking, initialDate)
  );

  const { clientId, practitionerId, serviceId, startDate, startTime, errors } = state;

  const [submitting, setSubmitting] = useState(false);

  // --- New client inline form ---
  const [showNewClient, setShowNewClient] = useState(false);
  const [newClientName, setNewClientName] = useState("");
  const [newClientPhone, setNewClientPhone] = useState("");
  const [creatingClient, setCreatingClient] = useState(false);

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
      if (newId) {
        dispatch({ type: "SET_FIELD", field: "clientId", value: newId });
      }
      setShowNewClient(false);
      setNewClientName("");
      setNewClientPhone("");
      onClientCreated?.();
    }
  };

  const selectedService = useMemo(
    () => services.find((s) => s.id === serviceId),
    [services, serviceId]
  );

  const activeServices = useMemo(
    () => services.filter((s) => s.is_active),
    [services]
  );

  // Filter practitioners by selected service (via practitioner_services join)
  const filteredPractitioners = useMemo(() => {
    const active = practitioners.filter((p) => p.is_active);
    if (!serviceId) return active;
    // Only show practitioners linked to the selected service
    const linked = active.filter(
      (p) => p.service_ids && p.service_ids.includes(serviceId)
    );
    // If no practitioner is linked (data not set up yet), show all
    return linked.length > 0 ? linked : active;
  }, [practitioners, serviceId]);

  // Auto-select practitioner if only one matches
  useMemo(() => {
    if (serviceId && filteredPractitioners.length === 1 && practitionerId !== filteredPractitioners[0].id) {
      dispatch({ type: "SET_FIELD", field: "practitionerId", value: filteredPractitioners[0].id });
    }
  }, [serviceId, filteredPractitioners, practitionerId]);

  // Check practitioner availability for the selected day
  const pracAvailability = useMemo(() => {
    if (!practitionerId || !startDate) return { works: true, dayAvail: null };
    const selectedPrac = practitioners.find((p) => p.id === practitionerId) as PractitionerWithServiceIds & { availability?: { day_of_week: number; start_time: string; end_time: string; is_available: boolean; exception_date: string | null }[] };
    if (!selectedPrac?.availability) return { works: true, dayAvail: null };
    const dayOfWeek = (new Date(startDate).getDay() + 6) % 7; // Monday=0

    // Check vacation day
    const isVacation = selectedPrac.availability.some(
      (a) => a.exception_date === startDate && !a.is_available
    );
    if (isVacation) return { works: false, dayAvail: null, reason: "en congé ce jour" };

    const dayAvail = selectedPrac.availability.find(
      (a) => a.day_of_week === dayOfWeek && a.exception_date === null
    );
    if (dayAvail && !dayAvail.is_available) {
      return { works: false, dayAvail: null, reason: "ne travaille pas ce jour" };
    }
    return { works: true, dayAvail: dayAvail ?? null };
  }, [practitioners, practitionerId, startDate]);

  // Build available time slots based on practitioner availability (excluding lunch break 13:00-14:00)
  const timeSlots = useMemo(() => {
    if (!pracAvailability.works) return [];
    let startH = 8;
    let endH = 20;
    if (pracAvailability.dayAvail) {
      startH = parseInt(pracAvailability.dayAvail.start_time.slice(0, 2));
      endH = parseInt(pracAvailability.dayAvail.end_time.slice(0, 2)) + (parseInt(pracAvailability.dayAvail.end_time.slice(3, 5)) > 0 ? 1 : 0);
    }
    // Exclude lunch break 13:00-14:00
    return generateTimeSlots(startH, endH).filter((t) => {
      const [h, m] = t.split(":").map(Number);
      const mins = h * 60 + m;
      return mins < 780 || mins >= 840; // 780 = 13:00, 840 = 14:00
    });
  }, [pracAvailability]);

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
    // Block booking during lunch break (13:00-14:00)
    if (startTime) {
      const [sh, sm] = startTime.split(":").map(Number);
      const startMins = sh * 60 + sm;
      if (startMins >= 780 && startMins < 840) {
        newErrors.startTime = "Ce créneau est pendant la pause déjeuner (13h-14h).";
      }
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

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {editBooking ? "Modifier le rendez-vous" : "Nouveau rendez-vous"}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4 mt-2 max-h-[70vh] overflow-y-auto">
          {/* Client */}
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-700">Client</label>
            {showNewClient ? (
              <div className="space-y-2 rounded-lg border border-dashed border-gray-300 p-3">
                <Input
                  placeholder="Nom du client *"
                  value={newClientName}
                  onChange={(e) => setNewClientName(e.target.value)}
                />
                <Input
                  placeholder="Téléphone"
                  value={newClientPhone}
                  onChange={(e) => setNewClientPhone(e.target.value)}
                />
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setShowNewClient(false)}
                  >
                    Annuler
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    onClick={handleCreateClient}
                    disabled={!newClientName.trim() || creatingClient}
                  >
                    {creatingClient ? "Création..." : "Ajouter"}
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex gap-2">
                <select
                  value={clientId}
                  onChange={(e) =>
                    dispatch({ type: "SET_FIELD", field: "clientId", value: e.target.value })
                  }
                  className="h-8 flex-1 rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                >
                  <option value="">Sélectionner un client...</option>
                  {clients.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name ?? "Sans nom"} {c.phone ? `— ${c.phone}` : ""}
                    </option>
                  ))}
                </select>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="h-8 w-8 shrink-0"
                  onClick={() => setShowNewClient(true)}
                  title="Nouveau client"
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            )}
            {errors.clientId && (
              <span className="text-xs text-destructive">{errors.clientId}</span>
            )}
          </div>

          {/* Service (AVANT praticien) */}
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-700">Service</label>
            <select
              value={serviceId}
              onChange={(e) => {
                dispatch({ type: "SET_FIELD", field: "serviceId", value: e.target.value });
                // Reset practitioner when service changes (will be auto-filtered)
                dispatch({ type: "SET_FIELD", field: "practitionerId", value: "" });
              }}
              className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              <option value="">Sélectionner un service...</option>
              {activeServices.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} — {s.duration_minutes} min — {(s.price_cents / 100).toFixed(2)} €
                </option>
              ))}
            </select>
            {errors.serviceId && (
              <span className="text-xs text-destructive">{errors.serviceId}</span>
            )}
          </div>

          {/* Praticien (filtré par service) */}
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-700">
              Praticien
              {serviceId && filteredPractitioners.length < practitioners.filter((p) => p.is_active).length && (
                <span className="text-xs text-gray-400 ml-1">
                  (filtrés par service)
                </span>
              )}
            </label>
            <select
              value={practitionerId}
              onChange={(e) =>
                dispatch({ type: "SET_FIELD", field: "practitionerId", value: e.target.value })
              }
              className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              <option value="">Sélectionner un praticien...</option>
              {filteredPractitioners.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
            {errors.practitionerId && (
              <span className="text-xs text-destructive">{errors.practitionerId}</span>
            )}
          </div>

          {/* Date */}
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-700">Date</label>
            <Input
              type="date"
              value={startDate}
              onChange={(e) =>
                dispatch({ type: "SET_FIELD", field: "startDate", value: e.target.value })
              }
            />
            {errors.startDate && (
              <span className="text-xs text-destructive">{errors.startDate}</span>
            )}
            {!errors.startDate && practitionerId && startDate && !pracAvailability.works && (
              <span className="text-xs text-red-600 bg-red-50 px-2 py-1 rounded">
                {practitioners.find((p) => p.id === practitionerId)?.name ?? "Ce praticien"} {pracAvailability.reason ?? "n'est pas disponible ce jour"}.
              </span>
            )}
          </div>

          {/* Heure (paliers 15 min, filtrée par horaires praticien) */}
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-700">
              Heure
              {practitionerId && timeSlots.length < generateTimeSlots(8, 20).length && (
                <span className="text-xs text-gray-400 ml-1">(selon horaires praticien)</span>
              )}
            </label>
            <select
              value={startTime}
              onChange={(e) =>
                dispatch({ type: "SET_FIELD", field: "startTime", value: e.target.value })
              }
              className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              <option value="">Choisir une heure...</option>
              {timeSlots.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
            {errors.startTime && (
              <span className="text-xs text-destructive">{errors.startTime}</span>
            )}
          </div>

          {/* Résumé durée */}
          {selectedService && startDate && startTime && (
            <div className="rounded-lg bg-muted/50 px-3 py-2 text-sm text-muted-foreground">
              Fin estimée :{" "}
              <span className="font-medium text-foreground">
                {new Date(
                  new Date(startDatetime).getTime() +
                    selectedService.duration_minutes * 60_000
                ).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
              </span>{" "}
              ({selectedService.duration_minutes} min)
            </div>
          )}

          <DialogFooter className="-mx-0 -mb-0 border-t-0 bg-transparent p-0 pt-2">
            <Button type="button" variant="outline" onClick={onClose} disabled={submitting}>
              Annuler
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting
                ? editBooking ? "Enregistrement..." : "Création..."
                : editBooking ? "Enregistrer" : "Créer le RDV"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default BookingForm;
