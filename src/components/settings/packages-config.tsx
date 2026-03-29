"use client";

import { useCallback, useEffect, useState } from "react";
import { Package, Plus, Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { formatEuros } from "@/lib/utils";
import type { Service } from "@/types/supabase";

interface PackageRow {
  id: string;
  name: string;
  service_id: string;
  total_uses: number;
  price_cents: number;
  validity_days: number | null;
  is_active: boolean;
  created_at: string;
  service: { id: string; name: string } | null;
}

const PackagesConfig = () => {
  const [packages, setPackages] = useState<PackageRow[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  // Form state
  const [formName, setFormName] = useState("");
  const [formServiceId, setFormServiceId] = useState("");
  const [formTotalUses, setFormTotalUses] = useState(5);
  const [formPriceCents, setFormPriceCents] = useState(0);
  const [formValidityDays, setFormValidityDays] = useState<number | "">("");

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [pkgRes, svcRes] = await Promise.all([
        fetch("/api/v1/packages?include_inactive=true"),
        fetch("/api/v1/services"),
      ]);

      if (pkgRes.ok) {
        const { data } = (await pkgRes.json()) as { data: PackageRow[] };
        setPackages(data);
      }

      if (svcRes.ok) {
        const { data } = (await svcRes.json()) as { data: Service[] };
        setServices(data);
        if (data.length > 0 && !formServiceId) {
          setFormServiceId(data[0].id);
        }
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleCreate = async () => {
    if (!formName.trim() || !formServiceId) {
      toast.error("Remplissez tous les champs obligatoires");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/v1/packages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formName.trim(),
          service_id: formServiceId,
          total_uses: formTotalUses,
          price_cents: formPriceCents,
          validity_days: formValidityDays || null,
        }),
      });

      if (res.ok) {
        toast.success("Forfait créé");
        setDialogOpen(false);
        resetForm();
        fetchData();
      } else {
        const err = (await res.json()) as { error: string };
        toast.error(err.error || "Erreur lors de la création");
      }
    } catch {
      toast.error("Erreur réseau");
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async (pkg: PackageRow) => {
    try {
      const res = await fetch(`/api/v1/packages/${pkg.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_active: !pkg.is_active, expected_is_active: pkg.is_active }),
      });

      if (res.ok) {
        setPackages((prev) =>
          prev.map((p) => (p.id === pkg.id ? { ...p, is_active: !p.is_active } : p)),
        );
        toast.success(pkg.is_active ? "Forfait désactivé" : "Forfait activé");
      } else {
        toast.error("Erreur lors de la mise à jour");
      }
    } catch {
      toast.error("Erreur réseau");
    }
  };

  const resetForm = () => {
    setFormName("");
    setFormServiceId(services[0]?.id ?? "");
    setFormTotalUses(5);
    setFormPriceCents(0);
    setFormValidityDays("");
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
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Package className="h-4 w-4" />
            Forfaits & Packs prépayés
          </CardTitle>
          <Button
            size="sm"
            className="gap-1.5"
            onClick={() => {
              resetForm();
              setDialogOpen(true);
            }}
          >
            <Plus className="h-3.5 w-3.5" />
            Créer un forfait
          </Button>
        </CardHeader>
        <CardContent>
          {packages.length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-4">
              Aucun forfait créé. Créez votre premier forfait prépayé.
            </p>
          ) : (
            <div className="space-y-3">
              {packages.map((pkg) => (
                <div
                  key={pkg.id}
                  className={`flex items-center justify-between p-3 rounded-lg border ${
                    pkg.is_active
                      ? "bg-white border-gray-200"
                      : "bg-gray-50 border-gray-100 opacity-60"
                  }`}
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-gray-900">{pkg.name}</p>
                      {!pkg.is_active && (
                        <span className="text-xs bg-gray-200 text-gray-500 px-1.5 py-0.5 rounded">
                          Inactif
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {pkg.total_uses} séances — {formatEuros(pkg.price_cents)}
                      {pkg.service?.name ? ` — ${pkg.service.name}` : ""}
                      {pkg.validity_days ? ` — Validité ${pkg.validity_days}j` : ""}
                    </p>
                  </div>
                  <button
                    onClick={() => handleToggle(pkg)}
                    className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                      pkg.is_active ? "bg-indigo-600" : "bg-gray-200"
                    }`}
                  >
                    <span
                      className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                        pkg.is_active ? "translate-x-4.5" : "translate-x-0.5"
                      }`}
                    />
                  </button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dialog création */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nouveau forfait</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nom</label>
              <Input
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder='ex : "Pack 5 coupes homme"'
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Service</label>
              <select
                value={formServiceId}
                onChange={(e) => setFormServiceId(e.target.value)}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              >
                {services.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nombre de séances
                </label>
                <Input
                  type="number"
                  min={1}
                  value={formTotalUses}
                  onChange={(e) => setFormTotalUses(parseInt(e.target.value, 10) || 1)}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Prix (€)
                </label>
                <Input
                  type="number"
                  min={0}
                  step={0.01}
                  value={(formPriceCents / 100).toFixed(2)}
                  onChange={(e) =>
                    setFormPriceCents(Math.round(parseFloat(e.target.value || "0") * 100))
                  }
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Validité (jours, optionnel)
              </label>
              <Input
                type="number"
                min={1}
                value={formValidityDays}
                onChange={(e) =>
                  setFormValidityDays(e.target.value ? parseInt(e.target.value, 10) : "")
                }
                placeholder="Illimité si vide"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setDialogOpen(false)}>
                Annuler
              </Button>
              <Button onClick={handleCreate} disabled={saving} className="gap-2">
                {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                Créer
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default PackagesConfig;
