"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type Step = "salon" | "services" | "practitioners" | "hours";

const OnboardingContent = () => {
  const [step, setStep] = useState<Step>("salon");
  const [salonName, setSalonName] = useState("");
  const [slug, setSlug] = useState("");
  const router = useRouter();

  const handleCreateSalon = async () => {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return;

    const { error } = await supabase.from("merchants").insert({
      user_id: user.id,
      name: salonName,
      slug: slug || salonName.toLowerCase().replace(/\s+/g, "-"),
      email: user.email ?? "",
      opening_hours: {
        monday: { open: "09:00", close: "19:00" },
        tuesday: { open: "09:00", close: "19:00" },
        wednesday: { open: "09:00", close: "19:00" },
        thursday: { open: "09:00", close: "19:00" },
        friday: { open: "09:00", close: "19:00" },
        saturday: { open: "09:00", close: "17:00" },
        sunday: null,
      },
    });

    if (!error) {
      setStep("services");
    }
  };

  const handleFinish = () => {
    router.push("/agenda");
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50">
      <Card className="w-full max-w-lg">
        <CardHeader>
          <CardTitle>Bienvenue sur Plan</CardTitle>
          <CardDescription>
            Configurez votre salon en quelques étapes
          </CardDescription>
          <div className="flex gap-2 pt-2">
            {(["salon", "services", "practitioners", "hours"] as Step[]).map(
              (s) => (
                <div
                  key={s}
                  className={`h-2 flex-1 rounded ${
                    s === step ? "bg-blue-500" : "bg-gray-200"
                  }`}
                />
              ),
            )}
          </div>
        </CardHeader>
        <CardContent>
          {step === "salon" && (
            <div className="space-y-4">
              <Input
                placeholder="Nom de votre salon"
                value={salonName}
                onChange={(e) => setSalonName(e.target.value)}
              />
              <Input
                placeholder="URL personnalisée (ex: mon-salon)"
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
              />
              <Button
                className="w-full"
                onClick={handleCreateSalon}
                disabled={!salonName}
              >
                Continuer
              </Button>
            </div>
          )}

          {step === "services" && (
            <div className="space-y-4">
              <p className="text-sm text-gray-600">
                Ajoutez vos services (vous pourrez les modifier plus tard dans
                Paramètres).
              </p>
              <Button className="w-full" onClick={() => setStep("practitioners")}>
                Continuer
              </Button>
            </div>
          )}

          {step === "practitioners" && (
            <div className="space-y-4">
              <p className="text-sm text-gray-600">
                Ajoutez vos praticiens et leurs spécialités.
              </p>
              <Button className="w-full" onClick={() => setStep("hours")}>
                Continuer
              </Button>
            </div>
          )}

          {step === "hours" && (
            <div className="space-y-4">
              <p className="text-sm text-gray-600">
                Les horaires par défaut sont 9h-19h du lundi au vendredi,
                9h-17h le samedi. Vous pourrez les personnaliser dans
                Paramètres.
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
