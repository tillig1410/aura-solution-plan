"use client";

import { useCallback, useEffect, useState } from "react";
import { Star, Save, Loader2, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { LoyaltyProgram } from "@/types/supabase";

const LoyaltyConfig = () => {
  const [program, setProgram] = useState<LoyaltyProgram | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Form state
  const [isActive, setIsActive] = useState(false);
  const [loyaltyModel, setLoyaltyModel] = useState<"cumulative" | "wallet">("cumulative");
  const [pointsMode, setPointsMode] = useState<"visit" | "euro">("visit");
  const [pointsPerVisit, setPointsPerVisit] = useState(10);
  const [pointsPerEuro, setPointsPerEuro] = useState(1);
  const [silverThreshold, setSilverThreshold] = useState(100);
  const [goldThreshold, setGoldThreshold] = useState(500);

  const fetchProgram = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/v1/loyalty");
      if (res.ok) {
        const { data } = (await res.json()) as { data: LoyaltyProgram | null };
        if (data) {
          setProgram(data);
          setIsActive(data.is_active);
          setPointsPerVisit(data.points_per_visit);
          setPointsPerEuro(data.points_per_euro);
          setPointsMode(data.points_per_euro > 0 && data.points_per_visit === 0 ? "euro" : "visit");
          setSilverThreshold(data.silver_threshold);
          setGoldThreshold(data.gold_threshold);
        }
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProgram();
  }, [fetchProgram]);

  const handleSave = async () => {
    if (goldThreshold <= silverThreshold) {
      toast.error("Le seuil Gold doit être supérieur au seuil Silver");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/v1/loyalty", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          is_active: isActive,
          points_per_visit: pointsMode === "visit" ? pointsPerVisit : 0,
          points_per_euro: pointsMode === "euro" ? pointsPerEuro : 0,
          silver_threshold: silverThreshold,
          gold_threshold: goldThreshold,
        }),
      });

      if (res.ok) {
        const { data } = (await res.json()) as { data: LoyaltyProgram };
        setProgram(data);
        toast.success("Programme de fidélité sauvegardé");
      } else {
        toast.error("Erreur lors de la sauvegarde");
      }
    } catch {
      toast.error("Erreur réseau");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="py-8 flex justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      {/* Activation */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Star className="h-4 w-4" />
            Programme de fidélité
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-900">Activer le programme</p>
              <p className="text-xs text-gray-500">
                Vos clients accumulent des points et montent en palier
              </p>
            </div>
            <button
              onClick={() => setIsActive(!isActive)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                isActive ? "bg-indigo-600" : "bg-gray-200"
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  isActive ? "translate-x-6" : "translate-x-1"
                }`}
              />
            </button>
          </div>
        </CardContent>
      </Card>

      {/* Configuration (visible seulement si actif) */}
      {isActive && (
        <>
          {/* Choix du modèle */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Type de programme</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setLoyaltyModel("cumulative")}
                  className={`rounded-lg border p-4 text-left transition-all ${
                    loyaltyModel === "cumulative"
                      ? "border-indigo-500 bg-indigo-50 ring-1 ring-indigo-500"
                      : "border-gray-200 hover:border-gray-300"
                  }`}
                >
                  <p className="text-sm font-bold text-gray-900">Paliers cumulatifs</p>
                  <p className="text-xs text-gray-500 mt-2 leading-relaxed">
                    Les points montent et ne redescendent jamais. Le client atteint des paliers
                    (Bronze, Silver, Gold) qui lui donnent des avantages permanents.
                  </p>
                  <p className="text-xs text-indigo-600 mt-2 font-medium">
                    Ex : 500 pts = Gold = 10% de remise à vie
                  </p>
                </button>
                <button
                  type="button"
                  onClick={() => setLoyaltyModel("wallet")}
                  className={`rounded-lg border p-4 text-left transition-all ${
                    loyaltyModel === "wallet"
                      ? "border-indigo-500 bg-indigo-50 ring-1 ring-indigo-500"
                      : "border-gray-200 hover:border-gray-300"
                  }`}
                >
                  <p className="text-sm font-bold text-gray-900">Porte-monnaie de points</p>
                  <p className="text-xs text-gray-500 mt-2 leading-relaxed">
                    Le client accumule des points et peut les dépenser contre des récompenses.
                    Son solde redescend après utilisation.
                  </p>
                  <p className="text-xs text-indigo-600 mt-2 font-medium">
                    Ex : 100 pts = 1 coupe offerte, solde remis à 0
                  </p>
                </button>
              </div>
            </CardContent>
          </Card>

          {/* Règles d'accumulation */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Comment les clients gagnent des points</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setPointsMode("visit")}
                  className={`rounded-lg border p-3 text-left transition-all ${
                    pointsMode === "visit"
                      ? "border-indigo-500 bg-indigo-50 ring-1 ring-indigo-500"
                      : "border-gray-200 hover:border-gray-300"
                  }`}
                >
                  <p className="text-sm font-medium text-gray-900">Par visite</p>
                  <p className="text-xs text-gray-500 mt-1">Points fixes à chaque passage</p>
                </button>
                <button
                  type="button"
                  onClick={() => setPointsMode("euro")}
                  className={`rounded-lg border p-3 text-left transition-all ${
                    pointsMode === "euro"
                      ? "border-indigo-500 bg-indigo-50 ring-1 ring-indigo-500"
                      : "border-gray-200 hover:border-gray-300"
                  }`}
                >
                  <p className="text-sm font-medium text-gray-900">Par euro dépensé</p>
                  <p className="text-xs text-gray-500 mt-1">Proportionnel au montant</p>
                </button>
              </div>

              {pointsMode === "visit" && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Points gagnés par visite
                  </label>
                  <Input
                    type="number"
                    min={1}
                    value={pointsPerVisit}
                    onChange={(e) => setPointsPerVisit(parseInt(e.target.value, 10) || 1)}
                    className="max-w-xs"
                  />
                </div>
              )}

              {pointsMode === "euro" && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Points gagnés par euro dépensé
                  </label>
                  <Input
                    type="number"
                    min={1}
                    value={pointsPerEuro}
                    onChange={(e) => setPointsPerEuro(parseInt(e.target.value, 10) || 1)}
                    className="max-w-xs"
                  />
                </div>
              )}
            </CardContent>
          </Card>

          {/* Paliers (mode cumulatif) */}
          {loyaltyModel === "cumulative" && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Paliers et avantages</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-xs text-gray-500">
                  Les paliers sont permanents : un client Gold reste Gold.
                </p>
                <div className="space-y-3">
                  <div className="flex items-center gap-3 p-3 bg-orange-50 rounded-lg border border-orange-100">
                    <span className="text-lg">🥉</span>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-orange-800">Bronze</p>
                      <p className="text-xs text-orange-600">0 points — palier par défaut</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border border-gray-200">
                    <span className="text-lg">🥈</span>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-800">Silver</p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs text-gray-500">À partir de</span>
                        <Input
                          type="number"
                          min={1}
                          value={silverThreshold}
                          onChange={(e) => setSilverThreshold(parseInt(e.target.value, 10) || 1)}
                          className="w-24 h-7 text-xs"
                        />
                        <span className="text-xs text-gray-500">points</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 p-3 bg-yellow-50 rounded-lg border border-yellow-200">
                    <span className="text-lg">🥇</span>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-yellow-800">Gold</p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs text-yellow-600">À partir de</span>
                        <Input
                          type="number"
                          min={1}
                          value={goldThreshold}
                          onChange={(e) => setGoldThreshold(parseInt(e.target.value, 10) || 1)}
                          className="w-24 h-7 text-xs"
                        />
                        <span className="text-xs text-yellow-600">points</span>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Récompenses (mode porte-monnaie) */}
          {loyaltyModel === "wallet" && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Récompenses</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-gray-500 mb-3">
                  Le client dépense ses points contre des récompenses. Son solde redescend après utilisation.
                </p>
                <div className="flex items-center gap-2 p-3 bg-amber-50 rounded-lg border border-amber-100">
                  <AlertCircle className="h-4 w-4 text-amber-600 shrink-0" />
                  <p className="text-sm text-amber-700">
                    La configuration des récompenses sera disponible prochainement.
                  </p>
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving} className="gap-2">
          <Save className="h-4 w-4" />
          {saving ? "Enregistrement..." : "Sauvegarder"}
        </Button>
      </div>
    </>
  );
};

export default LoyaltyConfig;
