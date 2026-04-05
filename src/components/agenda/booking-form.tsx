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
  client: { id: string; name: string | null; phone: string | null; preferred_language: string } | null;
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
  onSubmit: (data: CreateBookingData) => void;
  onClientCreated?: () => void;
  initialDate?: Date;
  editBooking?: BookingWithDetails;
  practitioners: PractitionerWithServiceIds[];
  services: Service[];
  clients: Client[];
}

// ---------- helpers ----------

const toLocalDatetimeValue = (date: Date): string => {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
    date.getHours()
  )}:${pad(date.getMinutes())}`;
};

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
  startDatetime: string;
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

const buildInitialState = (editBooking: BookingWithDetails | undefined, initialDate: Date | undefined): FormState => {
  if (editBooking) {
    return {
      clientId: editBooking.client_id,
      practitionerId: editBooking.practitioner_id,
      serviceId: editBooking.service_id,
      startDatetime: toLocalDatetimeValue(new Date(editBooking.starts_at)),
      errors: {},
    };
  }
  const base = initialDate ? new Date(initialDate) : new Date();
  base.setSeconds(0, 0);
  return {
    clientId: "",
    practitionerId: "",
    serviceId: "",
    startDatetime: toLocalDatetimeValue(base),
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

  const { clientId, practitionerId, serviceId, startDatetime, errors } = state;

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

  const validate = (): boolean => {
    const newErrors: Partial<Record<string, string>> = {};
    if (!clientId) newErrors.clientId = "Veuillez sélectionner un client.";
    if (!practitionerId) newErrors.practitionerId = "Veuillez sélectionner un praticien.";
    if (!serviceId) newErrors.serviceId = "Veuillez sélectionner un service.";
    if (!startDatetime) newErrors.startDatetime = "Veuillez indiquer une date et heure.";
    dispatch({ type: "SET_ERRORS", errors: newErrors });
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!validate()) return;

    const duration = selectedService?.duration_minutes ?? 60;
    const starts_at = new Date(startDatetime).toISOString();
    const ends_at = computeEndsAt(startDatetime, duration);

    onSubmit({
      client_id: clientId,
      practitioner_id: practitionerId,
      service_id: serviceId,
      starts_at,
      ends_at,
      source_channel: "dashboard",
    });
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

          {/* Date + heure */}
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-700">Date et heure de début</label>
            <Input
              type="datetime-local"
              value={startDatetime}
              onChange={(e) =>
                dispatch({ type: "SET_FIELD", field: "startDatetime", value: e.target.value })
              }
            />
            {errors.startDatetime && (
              <span className="text-xs text-destructive">{errors.startDatetime}</span>
            )}
          </div>

          {/* Résumé durée */}
          {selectedService && startDatetime && (
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
            <Button type="button" variant="outline" onClick={onClose}>
              Annuler
            </Button>
            <Button type="submit">
              {editBooking ? "Enregistrer" : "Créer le RDV"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default BookingForm;
