"use client";

import { useState, useEffect, type MutableRefObject } from "react";
import { Plus, Pencil, Save, Trash2 } from "lucide-react";
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
import type { Practitioner, Service } from "@/types/supabase";

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

interface PractitionerManagerProps {
  practitioners: PractitionerWithServices[];
  services: Service[];
  seatCount: number;
  onUpdate: () => void;
  onOpenNewRef?: MutableRefObject<(() => void) | null>;
}

const PRESET_COLORS = [
  "#6366f1", "#8b5cf6", "#ec4899", "#f43f5e",
  "#f97316", "#eab308", "#14b8a6",
  "#0ea5e9", "#3b82f6", "#6b7280", "#78716c",
];

const getInitials = (name: string) =>
  name.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2);

interface FormState {
  name: string;
  email: string;
  color: string;
  specialties: string;
  serviceIds: string[];
  isActive: boolean;
}

const emptyForm: FormState = {
  name: "",
  email: "",
  color: PRESET_COLORS[0],
  specialties: "",
  serviceIds: [],
  isActive: true,
};


const PractitionerManager = ({ practitioners, services, seatCount, onUpdate, onOpenNewRef }: PractitionerManagerProps) => {
  const activePracCount = practitioners.filter((p) => p.is_active).length;
  const seatLimitReached = activePracCount >= seatCount;
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<PractitionerWithServices | null>(null);

  const openNew = () => {
    setEditingId(null);
    setForm(emptyForm);
    setError(null);
    setDialogOpen(true);
  };

  // Expose openNew to parent via ref
  useEffect(() => {
    if (onOpenNewRef) onOpenNewRef.current = openNew;
    return () => { if (onOpenNewRef) onOpenNewRef.current = null; };
  });

  const openEdit = (prac: PractitionerWithServices) => {
    setEditingId(prac.id);
    setForm({
      name: prac.name,
      email: prac.email ?? "",
      color: prac.color,
      specialties: prac.specialties.join(", "),
      serviceIds: prac.service_ids,
      isActive: prac.is_active,
    });

    setError(null);
    setDialogOpen(true);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    const res = await fetch(`/api/v1/practitioners/${deleteTarget.id}`, { method: "DELETE" });
    if (res.ok) {
      toast.success(`${deleteTarget.name} supprimé`);
      onUpdate();
    } else {
      toast.error("Erreur lors de la suppression");
    }
    setDeleteTarget(null);
  };

  const toggleService = (serviceId: string) => {
    setForm((f) => ({
      ...f,
      serviceIds: f.serviceIds.includes(serviceId)
        ? f.serviceIds.filter((s) => s !== serviceId)
        : [...f.serviceIds, serviceId],
    }));
  };

  const handleSave = async () => {
    if (form.name.trim().length < 2) {
      setError("Le nom doit contenir au moins 2 caractères");
      return;
    }
    // Empêcher activation/création si limite sièges atteinte
    const isNew = !editingId;
    const wasInactive = editingId ? practitioners.find((p) => p.id === editingId)?.is_active === false : false;
    const wouldAddActive = (isNew || wasInactive) && form.isActive;
    if (wouldAddActive && seatLimitReached) {
      setError(`Limite de ${seatCount} siège${seatCount > 1 ? "s" : ""} atteinte. Upgradez votre forfait.`);
      return;
    }
    setSaving(true);
    setError(null);

    try {
      const specialties = form.specialties
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);

      const body = {
        name: form.name.trim(),
        email: form.email.trim() || null,
        color: form.color,
        specialties,
        is_active: form.isActive,
      };

      const baseUrl = "/api/v1/practitioners";
      const url = editingId ? `${baseUrl}/${editingId}` : baseUrl;
      const method = editingId ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const errBody = (await res.json()) as { error?: string };
        setError(errBody.error ?? "Erreur lors de la sauvegarde");
        return;
      }

      const practitioner = (await res.json()) as Practitioner;
      const practId = editingId ?? practitioner.id;

      // Availability is managed in the Horaires tab only (with breaks + vacations)

      // Save service assignments
      await fetch(`${baseUrl}/${practId}/services`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ service_ids: form.serviceIds }),
      });

      setDialogOpen(false);
      onUpdate();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {practitioners.map((prac) => (
          <Card key={prac.id} className={!prac.is_active ? "opacity-50" : ""}>
            <CardContent className="pt-4">
              <div className="flex items-start gap-3">
                <div
                  className="h-10 w-10 rounded-full flex items-center justify-center text-white font-bold text-sm shrink-0"
                  style={{ backgroundColor: prac.color }}
                >
                  {getInitials(prac.name)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-gray-900 truncate">{prac.name}</span>
                    {!prac.is_active && (
                      <span className="text-xs bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded">
                        Inactif
                      </span>
                    )}
                  </div>
                  {prac.specialties.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1">
                      {prac.specialties.map((spec) => (
                        <span
                          key={spec}
                          className="text-xs bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded-full"
                        >
                          {spec}
                        </span>
                      ))}
                    </div>
                  )}
                  <div className="text-xs text-gray-400 mt-2">
                    {prac.service_ids.length} service{prac.service_ids.length > 1 ? "s" : ""} assigné{prac.service_ids.length > 1 ? "s" : ""}
                  </div>
                </div>
                <div className="flex gap-1">
                  <Button variant="ghost" size="icon" onClick={() => openEdit(prac)} aria-label="Modifier">
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => setDeleteTarget(prac)} aria-label="Supprimer">
                    <Trash2 className="h-4 w-4 text-red-500" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Dialog Nouveau / Modifier */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? "Modifier le praticien" : "Nouveau praticien"}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Nom */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Nom <span className="text-red-500">*</span>
              </label>
              <Input
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="Prénom Nom"
              />
            </div>

            {/* Email */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <Input
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                placeholder="email@example.com"
                type="email"
              />
            </div>

            {/* Couleur */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Couleur</label>
              <div className="flex flex-wrap gap-2">
                {PRESET_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, color: c }))}
                    className={`h-8 w-8 rounded-full border-2 transition-all ${
                      form.color === c ? "border-gray-900 scale-110" : "border-transparent"
                    }`}
                    style={{ backgroundColor: c }}
                    aria-label={c}
                  />
                ))}
              </div>
            </div>

            {/* Spécialités */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Spécialités <span className="text-xs text-gray-400">(séparées par des virgules)</span>
              </label>
              <Input
                value={form.specialties}
                onChange={(e) => setForm((f) => ({ ...f, specialties: e.target.value }))}
                placeholder="Coloriste, Barbier..."
              />
            </div>

            {/* Services assignés */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Services assignés</label>
              <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto">
                {services.filter((s) => s.is_active).map((svc) => (
                  <label key={svc.id} className="flex items-center gap-2 text-sm cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form.serviceIds.includes(svc.id)}
                      onChange={() => toggleService(svc.id)}
                      className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                    />
                    <span className="truncate">{svc.name}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Note horaires */}
            <p className="text-xs text-gray-500 italic border border-gray-100 rounded p-2 bg-gray-50">
              Les horaires de travail et pauses se configurent dans l&apos;onglet &quot;Horaires&quot;.
            </p>

            {/* Actif */}
            {editingId && (
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.isActive}
                  onChange={() => setForm((f) => ({ ...f, isActive: !f.isActive }))}
                  className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                />
                <span>Praticien actif</span>
              </label>
            )}

            {error && (
              <p className="text-sm text-red-600 bg-red-50 p-2 rounded border border-red-100">
                {error}
              </p>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Annuler
            </Button>
            <Button onClick={handleSave} disabled={saving} className="gap-2">
              <Save className="h-4 w-4" />
              {saving ? "Enregistrement..." : "Sauvegarder"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog confirmation suppression */}
      <Dialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Supprimer le praticien</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-gray-600">
            Voulez-vous vraiment supprimer <strong>{deleteTarget?.name}</strong> ?
            Ses rendez-vous existants seront conservés mais il ne sera plus assignable.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              Annuler
            </Button>
            <Button variant="destructive" onClick={handleDelete}>
              Supprimer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PractitionerManager;
