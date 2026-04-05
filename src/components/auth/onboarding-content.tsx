"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Search, Plus, Trash2, MapPin, Store } from "lucide-react";

type Step = "salon" | "services" | "practitioners" | "done";

interface PlaceResult {
  placeId: string;
  name: string;
  address: string;
  phone: string;
}

interface ServiceDraft {
  name: string;
  duration: number;
  price: string;
}

interface PractitionerDraft {
  name: string;
  specialties: string;
}

const COLORS = [
  "#3B82F6", "#EF4444", "#10B981", "#F59E0B", "#8B5CF6",
  "#EC4899", "#06B6D4", "#F97316", "#6366F1", "#14B8A6",
];

const OnboardingContent = () => {
  const [step, setStep] = useState<Step>("salon");
  const router = useRouter();

  // --- Step 1: Salon ---
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<PlaceResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [noApiKey, setNoApiKey] = useState(false);
  const [salonName, setSalonName] = useState("");
  const [salonAddress, setSalonAddress] = useState("");
  const [salonPhone, setSalonPhone] = useState("");
  const [slug, setSlug] = useState("");
  const [googlePlaceId, setGooglePlaceId] = useState<string | null>(null);
  const [merchantId, setMerchantId] = useState<string | null>(null);

  // --- Step 2: Services ---
  const [services, setServices] = useState<ServiceDraft[]>([
    { name: "", duration: 30, price: "" },
  ]);

  // --- Step 3: Practitioners ---
  const [practitioners, setPractitioners] = useState<PractitionerDraft[]>([
    { name: "", specialties: "" },
  ]);

  const [mode, setMode] = useState<"search" | "manual">("search");

  // --- Google Places search ---
  const searchPlaces = useCallback(async (query: string) => {
    if (query.length < 3) {
      setSearchResults([]);
      return;
    }
    setSearching(true);
    try {
      const res = await fetch(
        `/api/v1/places/search?q=${encodeURIComponent(query)}`
      );
      const data = await res.json();
      if (data.error === "no_api_key") {
        setNoApiKey(true);
        setMode("manual");
      }
      setSearchResults(data.results ?? []);
    } catch {
      setSearchResults([]);
    } finally {
      setSearching(false);
    }
  }, []);

  const handleSearchInput = (value: string) => {
    setSearchQuery(value);
    if (value.length >= 3) {
      setTimeout(() => searchPlaces(value), 400);
    } else {
      setSearchResults([]);
    }
  };

  const selectPlace = (place: PlaceResult) => {
    setSalonName(place.name);
    setSalonAddress(place.address);
    setSalonPhone(place.phone);
    setGooglePlaceId(place.placeId);
    setSlug(place.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/-+$/, ""));
    setSearchResults([]);
    setSearchQuery("");
  };

  const [salonError, setSalonError] = useState("");
  const [salonLoading, setSalonLoading] = useState(false);

  const handleCreateSalon = async () => {
    setSalonError("");
    setSalonLoading(true);
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setSalonError("Session expirée. Reconnectez-vous.");
      setSalonLoading(false);
      return;
    }

    // Check if merchant already exists (e.g. previous attempt)
    const { data: existing } = await supabase
      .from("merchants")
      .select("id")
      .eq("user_id", user.id)
      .single();

    if (existing) {
      // Update existing merchant instead of inserting
      const { error } = await supabase
        .from("merchants")
        .update({
          name: salonName,
          slug: slug || salonName.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
          phone: salonPhone || null,
          address: salonAddress || null,
          google_place_id: googlePlaceId,
        })
        .eq("id", existing.id);

      setSalonLoading(false);
      if (error) {
        setSalonError(error.message);
        return;
      }
      setMerchantId(existing.id);
      setStep("services");
      return;
    }

    const { data, error } = await supabase
      .from("merchants")
      .insert({
        user_id: user.id,
        name: salonName,
        slug: slug || salonName.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
        email: user.email ?? "",
        phone: salonPhone || null,
        address: salonAddress || null,
        google_place_id: googlePlaceId,
        opening_hours: {
          monday: { open: "09:00", close: "19:00" },
          tuesday: { open: "09:00", close: "19:00" },
          wednesday: { open: "09:00", close: "19:00" },
          thursday: { open: "09:00", close: "19:00" },
          friday: { open: "09:00", close: "19:00" },
          saturday: { open: "09:00", close: "17:00" },
          sunday: null,
        },
      })
      .select("id")
      .single();

    setSalonLoading(false);

    if (error) {
      setSalonError(error.message);
      return;
    }

    if (data) {
      setMerchantId(data.id);
      setStep("services");
    }
  };

  // --- Step 2: Save services ---
  const addService = () => {
    setServices([...services, { name: "", duration: 30, price: "" }]);
  };

  const removeService = (index: number) => {
    if (services.length <= 1) return;
    setServices(services.filter((_, i) => i !== index));
  };

  const updateService = (
    index: number,
    field: keyof ServiceDraft,
    value: string | number
  ) => {
    const updated = [...services];
    updated[index] = { ...updated[index], [field]: value };
    setServices(updated);
  };

  const handleSaveServices = async () => {
    if (!merchantId) return;
    const supabase = createClient();

    const validServices = services.filter((s) => s.name.trim());
    if (validServices.length > 0) {
      await supabase.from("services").insert(
        validServices.map((s, i) => ({
          merchant_id: merchantId,
          name: s.name.trim(),
          duration_minutes: s.duration,
          price_cents: Math.round(parseFloat(s.price || "0") * 100),
          sort_order: i,
        }))
      );
    }

    setStep("practitioners");
  };

  // --- Step 3: Save practitioners ---
  const maxPractitioners = 1; // seat_count par défaut

  const addPractitioner = () => {
    if (practitioners.length >= maxPractitioners) return;
    setPractitioners([...practitioners, { name: "", specialties: "" }]);
  };

  const removePractitioner = (index: number) => {
    if (practitioners.length <= 1) return;
    setPractitioners(practitioners.filter((_, i) => i !== index));
  };

  const updatePractitioner = (
    index: number,
    field: keyof PractitionerDraft,
    value: string
  ) => {
    const updated = [...practitioners];
    updated[index] = { ...updated[index], [field]: value };
    setPractitioners(updated);
  };

  const handleSavePractitioners = async () => {
    if (!merchantId) return;
    const supabase = createClient();

    const validPractitioners = practitioners.filter((p) => p.name.trim());
    if (validPractitioners.length > 0) {
      await supabase.from("practitioners").insert(
        validPractitioners.map((p, i) => ({
          merchant_id: merchantId,
          name: p.name.trim(),
          color: COLORS[i % COLORS.length],
          specialties: p.specialties
            ? p.specialties.split(",").map((s) => s.trim())
            : [],
          sort_order: i,
        }))
      );
    }

    setStep("done");
  };

  const handleFinish = () => {
    router.push("/agenda");
  };

  const steps: Step[] = ["salon", "services", "practitioners", "done"];
  const stepLabels = ["Salon", "Services", "Praticiens", "Terminé"];

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 p-4">
      <Card className="w-full max-w-lg">
        <CardHeader>
          <CardTitle>Bienvenue sur Resaapp</CardTitle>
          <CardDescription>
            Configurez votre salon en quelques étapes
          </CardDescription>
          <div className="flex gap-2 pt-2">
            {steps.map((s, i) => (
              <div key={s} className="flex-1 text-center">
                <div
                  className={`h-2 rounded mb-1 ${
                    steps.indexOf(step) >= i ? "bg-blue-500" : "bg-gray-200"
                  }`}
                />
                <span className="text-xs text-gray-500">{stepLabels[i]}</span>
              </div>
            ))}
          </div>
        </CardHeader>

        <CardContent>
          {/* STEP 1: Salon info */}
          {step === "salon" && (
            <div className="space-y-4">
              {/* Mode tabs */}
              {!noApiKey && (
                <div className="flex rounded-lg border overflow-hidden">
                  <button
                    type="button"
                    className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium transition-colors ${
                      mode === "search"
                        ? "bg-blue-50 text-blue-700 border-b-2 border-blue-500"
                        : "bg-white text-gray-500 hover:bg-gray-50"
                    }`}
                    onClick={() => setMode("search")}
                  >
                    <MapPin className="h-4 w-4" />
                    Recherche Google Maps
                  </button>
                  <button
                    type="button"
                    className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium transition-colors ${
                      mode === "manual"
                        ? "bg-blue-50 text-blue-700 border-b-2 border-blue-500"
                        : "bg-white text-gray-500 hover:bg-gray-50"
                    }`}
                    onClick={() => setMode("manual")}
                  >
                    <Store className="h-4 w-4" />
                    Saisie manuelle
                  </button>
                </div>
              )}

              {/* Google Maps search mode */}
              {mode === "search" && !noApiKey && (
                <div className="space-y-3">
                  <p className="text-sm text-gray-500">
                    Recherchez votre salon pour remplir automatiquement les informations.
                  </p>

                  {/* Selected place banner */}
                  {salonName && googlePlaceId ? (
                    <div className="rounded-md bg-blue-50 p-3 space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-sm">{salonName}</span>
                        <button
                          type="button"
                          className="text-xs text-gray-400 hover:text-gray-600"
                          onClick={() => {
                            setSalonName("");
                            setSalonAddress("");
                            setSalonPhone("");
                            setGooglePlaceId(null);
                            setSlug("");
                          }}
                        >
                          Modifier
                        </button>
                      </div>
                      {salonAddress && (
                        <p className="text-xs text-gray-500">{salonAddress}</p>
                      )}
                      {salonPhone && (
                        <p className="text-xs text-gray-500">{salonPhone}</p>
                      )}
                    </div>
                  ) : (
                    <div className="relative">
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                        <Input
                          className="pl-10"
                          placeholder="Nom du salon, adresse..."
                          value={searchQuery}
                          onChange={(e) => handleSearchInput(e.target.value)}
                        />
                      </div>
                      {searching && (
                        <p className="text-xs text-gray-400 mt-1">Recherche en cours...</p>
                      )}
                      {searchResults.length > 0 && (
                        <div className="absolute z-10 mt-1 w-full rounded-md border bg-white shadow-lg max-h-60 overflow-auto">
                          {searchResults.map((place) => (
                            <button
                              key={place.placeId}
                              type="button"
                              className="w-full text-left px-4 py-3 hover:bg-gray-50 border-b last:border-b-0"
                              onClick={() => selectPlace(place)}
                            >
                              <div className="flex items-start gap-2">
                                <MapPin className="h-4 w-4 text-blue-500 mt-0.5 shrink-0" />
                                <div>
                                  <p className="font-medium text-sm">{place.name}</p>
                                  <p className="text-xs text-gray-500">{place.address}</p>
                                </div>
                              </div>
                            </button>
                          ))}
                        </div>
                      )}
                      {searchQuery.length >= 3 && !searching && searchResults.length === 0 && (
                        <p className="text-xs text-gray-400 mt-1">
                          Aucun résultat. Essayez un autre nom ou passez en saisie manuelle.
                        </p>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Manual mode */}
              {(mode === "manual" || noApiKey) && (
                <div className="space-y-3">
                  <p className="text-sm text-gray-500">
                    Remplissez les informations de votre salon.
                  </p>
                  <Input
                    placeholder="Nom du salon *"
                    value={salonName}
                    onChange={(e) => {
                      setSalonName(e.target.value);
                      setSlug(
                        e.target.value
                          .toLowerCase()
                          .replace(/[^a-z0-9]+/g, "-")
                          .replace(/-+$/, "")
                      );
                    }}
                  />
                  <Input
                    placeholder="Adresse"
                    value={salonAddress}
                    onChange={(e) => setSalonAddress(e.target.value)}
                  />
                  <Input
                    placeholder="Téléphone"
                    value={salonPhone}
                    onChange={(e) => setSalonPhone(e.target.value)}
                  />
                </div>
              )}

              {salonError && (
                <p className="text-sm text-red-500 bg-red-50 p-2 rounded">
                  {salonError}
                </p>
              )}
              <Button
                className="w-full"
                onClick={handleCreateSalon}
                disabled={!salonName || salonLoading}
              >
                {salonLoading ? "Création..." : "Continuer"}
              </Button>
            </div>
          )}

          {/* STEP 2: Services */}
          {step === "services" && (
            <div className="space-y-4">
              <p className="text-sm text-gray-600">
                Ajoutez les prestations de votre salon.
              </p>

              {services.map((service, index) => (
                <div
                  key={index}
                  className="flex items-start gap-2 rounded-md border p-3"
                >
                  <div className="flex-1 space-y-2">
                    <Input
                      placeholder="Nom (ex: Coupe homme)"
                      value={service.name}
                      onChange={(e) =>
                        updateService(index, "name", e.target.value)
                      }
                    />
                    <div className="flex gap-2">
                      <div className="flex-1">
                        <label className="text-xs text-gray-500">
                          Durée (min)
                        </label>
                        <Input
                          type="number"
                          min={5}
                          step={5}
                          value={service.duration}
                          onChange={(e) =>
                            updateService(
                              index,
                              "duration",
                              parseInt(e.target.value) || 0
                            )
                          }
                        />
                      </div>
                      <div className="flex-1">
                        <label className="text-xs text-gray-500">
                          Prix (EUR)
                        </label>
                        <Input
                          type="number"
                          min={0}
                          step={0.5}
                          placeholder="25"
                          value={service.price}
                          onChange={(e) =>
                            updateService(index, "price", e.target.value)
                          }
                        />
                      </div>
                    </div>
                  </div>
                  {services.length > 1 && (
                    <button
                      type="button"
                      className="mt-2 text-gray-400 hover:text-red-500"
                      onClick={() => removeService(index)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              ))}

              <Button
                variant="outline"
                className="w-full"
                onClick={addService}
              >
                <Plus className="h-4 w-4 mr-2" />
                Ajouter un service
              </Button>

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => setStep("salon")}
                >
                  Retour
                </Button>
                <Button
                  variant="ghost"
                  className="flex-1"
                  onClick={() => setStep("practitioners")}
                >
                  Passer
                </Button>
                <Button
                  className="flex-1"
                  onClick={handleSaveServices}
                  disabled={!services.some((s) => s.name.trim())}
                >
                  Continuer
                </Button>
              </div>
            </div>
          )}

          {/* STEP 3: Practitioners */}
          {step === "practitioners" && (
            <div className="space-y-4">
              <p className="text-sm text-gray-600">
                Ajoutez les membres de votre équipe.
              </p>

              {practitioners.map((practitioner, index) => (
                <div
                  key={index}
                  className="flex items-start gap-2 rounded-md border p-3"
                >
                  <div
                    className="mt-2 h-4 w-4 rounded-full shrink-0"
                    style={{ backgroundColor: COLORS[index % COLORS.length] }}
                  />
                  <div className="flex-1 space-y-2">
                    <Input
                      placeholder="Nom du praticien"
                      value={practitioner.name}
                      onChange={(e) =>
                        updatePractitioner(index, "name", e.target.value)
                      }
                    />
                    <Input
                      placeholder="Services maîtrisés (ex: Coupe, Coloration, Barbe)"
                      value={practitioner.specialties}
                      onChange={(e) =>
                        updatePractitioner(
                          index,
                          "specialties",
                          e.target.value
                        )
                      }
                    />
                  </div>
                  {practitioners.length > 1 && (
                    <button
                      type="button"
                      className="mt-2 text-gray-400 hover:text-red-500"
                      onClick={() => removePractitioner(index)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              ))}

              {practitioners.length < maxPractitioners ? (
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={addPractitioner}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Ajouter un praticien
                </Button>
              ) : (
                <p className="text-xs text-center text-gray-400">
                  Votre forfait permet {maxPractitioners} praticien{maxPractitioners > 1 ? "s" : ""}. Vous pourrez upgrader dans Paramètres.
                </p>
              )}

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => setStep("services")}
                >
                  Retour
                </Button>
                <Button
                  variant="ghost"
                  className="flex-1"
                  onClick={() => setStep("done")}
                >
                  Passer
                </Button>
                <Button
                  className="flex-1"
                  onClick={handleSavePractitioners}
                  disabled={!practitioners.some((p) => p.name.trim())}
                >
                  Continuer
                </Button>
              </div>
            </div>
          )}

          {/* STEP 4: Done */}
          {step === "done" && (
            <div className="space-y-4 text-center">
              <div className="text-5xl">🎉</div>
              <h3 className="text-lg font-semibold">Votre salon est prêt !</h3>
              <p className="text-sm text-gray-600">
                Vous pourrez modifier vos services, praticiens et horaires à
                tout moment dans les Paramètres.
              </p>
              <Button className="w-full" onClick={handleFinish}>
                Accéder au dashboard
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default OnboardingContent;
