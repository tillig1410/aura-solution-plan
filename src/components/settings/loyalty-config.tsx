"use client";

import { useCallback, useEffect, useState } from "react";
import { Star, Save, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { LoyaltyProgram } from "@/types/supabase";

interface LoyaltyConfigProps {
  merchantId: string;
}

const LoyaltyConfig = ({ merchantId }: LoyaltyConfigProps) => {
  const [program, setProgram] = useState<LoyaltyProgram | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Form state
  const [isActive, setIsActive] = useState(false);
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
          points_per_visit: pointsPerVisit,
          points_per_euro: pointsPerEuro,
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
                Vos clients accumulent des points à chaque visite et euro dépensé
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
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Règles d&apos;accumulation</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Points par visite
                  </label>
                  <Input
                    type="number"
                    min={0}
                    value={pointsPerVisit}
                    onChange={(e) => setPointsPerVisit(parseInt(e.target.value, 10) || 0)}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Points par euro dépensé
                  </label>
                  <Input
                    type="number"
                    min={0}
                    value={pointsPerEuro}
                    onChange={(e) => setPointsPerEuro(parseInt(e.target.value, 10) || 0)}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Paliers</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
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
