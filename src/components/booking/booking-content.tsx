"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Calendar, Clock, User, CheckCircle2, ChevronRight, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { formatEuros } from "@/lib/utils";

// ---------- Types ----------

interface ServicePublic {
  id: string;
  name: string;
  description: string | null;
  duration_minutes: number;
  price_cents: number;
}

interface PractitionerPublic {
  id: string;
  name: string;
  color: string;
  specialties: string[];
  service_ids: string[];
}

interface SalonData {
  name: string;
  slug: string;
  address: string | null;
  phone: string | null;
  ai_name: string | null;
  services: ServicePublic[];
  practitioners: PractitionerPublic[];
}

type Step = "service" | "practitioner" | "datetime" | "info" | "confirmation";

// ---------- Component ----------

const BookingContent = () => {
  const { slug } = useParams<{ slug: string }>();
  const [salon, setSalon] = useState<SalonData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Selection state
  const [step, setStep] = useState<Step>("service");
  const [selectedService, setSelectedService] = useState<ServicePublic | null>(null);
  const [selectedPractitioner, setSelectedPractitioner] = useState<PractitionerPublic | null>(null);
  const [selectedDate, setSelectedDate] = useState("");
  const [selectedTime, setSelectedTime] = useState("");

  // Client info
  const [clientName, setClientName] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const [clientEmail, setClientEmail] = useState("");

  // Submission
  const [submitting, setSubmitting] = useState(false);
  const [bookingResult, setBookingResult] = useState<{ id: string; starts_at: string } | null>(null);

  const fetchSalon = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/v1/booking/${slug}`);
      if (!res.ok) {
        setError("Salon introuvable");
        return;
      }
      const { data } = (await res.json()) as { data: SalonData };
      setSalon(data);
    } catch {
      setError("Erreur de chargement");
    } finally {
      setLoading(false);
    }
  }, [slug]);

  useEffect(() => {
    fetchSalon();
  }, [fetchSalon]);

  const eligiblePractitioners = salon?.practitioners.filter((p) =>
    selectedService ? p.service_ids.includes(selectedService.id) : true,
  ) ?? [];

  const handleSubmit = async () => {
    if (!selectedService || !selectedPractitioner || !selectedDate || !selectedTime || !clientName || !clientPhone) {
      return;
    }

    setSubmitting(true);
    try {
      const startsAt = `${selectedDate}T${selectedTime}:00`;

      const res = await fetch(`/api/v1/booking/${slug}/reserve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          client_name: clientName,
          client_phone: clientPhone,
          client_email: clientEmail || undefined,
          practitioner_id: selectedPractitioner.id,
          service_id: selectedService.id,
          starts_at: new Date(startsAt).toISOString(),
        }),
      });

      if (res.ok) {
        const { data } = (await res.json()) as { data: { id: string; starts_at: string } };
        setBookingResult(data);
        setStep("confirmation");
      } else {
        const err = (await res.json()) as { error: string };
        setError(err.error || "Erreur lors de la réservation");
      }
    } catch {
      setError("Erreur réseau");
    } finally {
      setSubmitting(false);
    }
  };

  const goBack = () => {
    const steps: Step[] = ["service", "practitioner", "datetime", "info"];
    const idx = steps.indexOf(step);
    if (idx > 0) setStep(steps[idx - 1]);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error && !salon) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <p className="text-gray-500">{error}</p>
      </div>
    );
  }

  if (!salon) return null;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-indigo-600 text-white py-8 px-4">
        <div className="max-w-lg mx-auto text-center">
          <h1 className="text-2xl font-bold">{salon.name}</h1>
          {salon.address && <p className="text-indigo-200 text-sm mt-1">{salon.address}</p>}
          <p className="text-indigo-100 text-xs mt-2">Réservation en ligne</p>
        </div>
      </div>

      {/* Progress */}
      <div className="max-w-lg mx-auto px-4 py-4">
        <div className="flex items-center justify-between text-xs text-gray-400 mb-6">
          {(["Service", "Praticien", "Date & Heure", "Vos infos"] as const).map((label, i) => {
            const steps: Step[] = ["service", "practitioner", "datetime", "info"];
            const isActive = steps.indexOf(step) >= i || step === "confirmation";
            return (
              <div key={label} className="flex items-center gap-1">
                <div
                  className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                    isActive ? "bg-indigo-600 text-white" : "bg-gray-200 text-gray-500"
                  }`}
                >
                  {i + 1}
                </div>
                <span className={isActive ? "text-indigo-600 font-medium" : ""}>{label}</span>
              </div>
            );
          })}
        </div>

        {/* Step Navigation Back */}
        {step !== "service" && step !== "confirmation" && (
          <button onClick={goBack} className="flex items-center gap-1 text-sm text-gray-500 mb-4 hover:text-gray-700">
            <ArrowLeft className="h-4 w-4" />
            Retour
          </button>
        )}

        {/* Step 1: Service */}
        {step === "service" && (
          <div className="space-y-3">
            <h2 className="text-lg font-semibold text-gray-900">Choisissez un service</h2>
            {salon.services.map((s) => (
              <Card
                key={s.id}
                className={`cursor-pointer transition-all hover:border-indigo-300 ${
                  selectedService?.id === s.id ? "border-indigo-500 ring-1 ring-indigo-500" : ""
                }`}
                onClick={() => {
                  setSelectedService(s);
                  setSelectedPractitioner(null);
                  setStep("practitioner");
                }}
              >
                <CardContent className="py-4 flex items-center justify-between">
                  <div>
                    <p className="font-medium text-gray-900">{s.name}</p>
                    {s.description && (
                      <p className="text-xs text-gray-500 mt-0.5">{s.description}</p>
                    )}
                    <div className="flex items-center gap-3 mt-1 text-xs text-gray-400">
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {s.duration_minutes} min
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-indigo-600">
                      {formatEuros(s.price_cents)}
                    </span>
                    <ChevronRight className="h-4 w-4 text-gray-400" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Step 2: Practitioner */}
        {step === "practitioner" && (
          <div className="space-y-3">
            <h2 className="text-lg font-semibold text-gray-900">Choisissez un praticien</h2>
            {eligiblePractitioners.map((p) => (
              <Card
                key={p.id}
                className={`cursor-pointer transition-all hover:border-indigo-300 ${
                  selectedPractitioner?.id === p.id ? "border-indigo-500 ring-1 ring-indigo-500" : ""
                }`}
                onClick={() => {
                  setSelectedPractitioner(p);
                  setStep("datetime");
                }}
              >
                <CardContent className="py-4 flex items-center gap-3">
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm"
                    style={{ backgroundColor: p.color }}
                  >
                    {p.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-gray-900">{p.name}</p>
                    {p.specialties.length > 0 && (
                      <p className="text-xs text-gray-500">
                        {p.specialties.join(", ")}
                      </p>
                    )}
                  </div>
                  <ChevronRight className="h-4 w-4 text-gray-400" />
                </CardContent>
              </Card>
            ))}
            {eligiblePractitioners.length === 0 && (
              <p className="text-sm text-gray-500 text-center py-4">
                Aucun praticien disponible pour ce service.
              </p>
            )}
          </div>
        )}

        {/* Step 3: Date & Time */}
        {step === "datetime" && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-gray-900">Choisissez la date et l&apos;heure</h2>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                <Calendar className="h-4 w-4 inline mr-1" />
                Date
              </label>
              <Input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                min={new Date().toISOString().split("T")[0]}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                <Clock className="h-4 w-4 inline mr-1" />
                Heure
              </label>
              <Input
                type="time"
                value={selectedTime}
                onChange={(e) => setSelectedTime(e.target.value)}
                min="08:00"
                max="20:00"
                step={900}
              />
            </div>
            <Button
              className="w-full"
              disabled={!selectedDate || !selectedTime}
              onClick={() => setStep("info")}
            >
              Continuer
            </Button>
          </div>
        )}

        {/* Step 4: Client Info */}
        {step === "info" && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-gray-900">Vos informations</h2>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                <User className="h-4 w-4 inline mr-1" />
                Nom complet *
              </label>
              <Input
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                placeholder="Jean Dupont"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Téléphone *
              </label>
              <Input
                value={clientPhone}
                onChange={(e) => setClientPhone(e.target.value)}
                placeholder="+33 6 12 34 56 78"
                type="tel"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Email (optionnel)
              </label>
              <Input
                value={clientEmail}
                onChange={(e) => setClientEmail(e.target.value)}
                placeholder="jean@email.com"
                type="email"
              />
            </div>

            {/* Récapitulatif */}
            <Card className="bg-indigo-50 border-indigo-200">
              <CardContent className="py-4">
                <h3 className="text-sm font-semibold text-indigo-800 mb-2">Récapitulatif</h3>
                <div className="space-y-1 text-sm text-indigo-700">
                  <p>{selectedService?.name} — {formatEuros(selectedService?.price_cents ?? 0)}</p>
                  <p>avec {selectedPractitioner?.name}</p>
                  <p>
                    {selectedDate && new Date(`${selectedDate}T12:00`).toLocaleDateString("fr-FR", {
                      weekday: "long",
                      day: "numeric",
                      month: "long",
                    })}{" "}
                    à {selectedTime}
                  </p>
                </div>
              </CardContent>
            </Card>

            {error && (
              <p className="text-sm text-red-600 bg-red-50 p-2 rounded">{error}</p>
            )}

            <Button
              className="w-full"
              disabled={!clientName || !clientPhone || submitting}
              onClick={handleSubmit}
            >
              {submitting ? "Réservation en cours..." : "Confirmer le rendez-vous"}
            </Button>
          </div>
        )}

        {/* Step 5: Confirmation */}
        {step === "confirmation" && bookingResult && (
          <div className="text-center py-8 space-y-4">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
              <CheckCircle2 className="h-8 w-8 text-green-600" />
            </div>
            <h2 className="text-xl font-bold text-gray-900">Rendez-vous confirmé !</h2>
            <div className="text-sm text-gray-600 space-y-1">
              <p>{selectedService?.name} avec {selectedPractitioner?.name}</p>
              <p className="font-medium">
                {new Date(bookingResult.starts_at).toLocaleDateString("fr-FR", {
                  weekday: "long",
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })}{" "}
                à{" "}
                {new Date(bookingResult.starts_at).toLocaleTimeString("fr-FR", {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </p>
            </div>
            <p className="text-xs text-gray-400">
              Vous recevrez un rappel avant votre rendez-vous.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default BookingContent;
