"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Store,
  Bot,
  CreditCard,
  Globe,
  Star,
  UsersRound,
  Receipt,
  Save,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/client";
import AiConfig from "@/components/settings/ai-config";
import type { Merchant } from "@/types/supabase";

// ---------- Types ----------

type SettingsTab =
  | "salon"
  | "ia"
  | "paiements"
  | "site"
  | "fidelite"
  | "equipe"
  | "abonnement";

const TABS: { value: SettingsTab; label: string; icon: React.ReactNode }[] = [
  { value: "salon", label: "Mon salon", icon: <Store className="h-4 w-4" /> },
  { value: "ia", label: "IA & Canaux", icon: <Bot className="h-4 w-4" /> },
  { value: "paiements", label: "Paiements", icon: <CreditCard className="h-4 w-4" /> },
  { value: "site", label: "Mon site", icon: <Globe className="h-4 w-4" /> },
  { value: "fidelite", label: "Fidélité", icon: <Star className="h-4 w-4" /> },
  { value: "equipe", label: "Équipe", icon: <UsersRound className="h-4 w-4" /> },
  { value: "abonnement", label: "Mon abonnement", icon: <Receipt className="h-4 w-4" /> },
];

const ComingSoonCard = ({ title, phase }: { title: string; phase: string }) => (
  <Card>
    <CardContent className="py-12 text-center">
      <p className="text-sm text-gray-500 mb-2">{title}</p>
      <span className="text-xs bg-indigo-50 text-indigo-600 px-3 py-1 rounded-full font-medium">
        Disponible {phase}
      </span>
    </CardContent>
  </Card>
);

// ---------- Component ----------

const SettingsPage = () => {
  const [tab, setTab] = useState<SettingsTab>("salon");
  const [merchant, setMerchant] = useState<Merchant | null>(null);
  const [loading, setLoading] = useState(true);

  // Salon form
  const [salonName, setSalonName] = useState("");
  const [salonAddress, setSalonAddress] = useState("");
  const [salonPhone, setSalonPhone] = useState("");
  const [salonEmail, setSalonEmail] = useState("");
  const [salonSlug, setSalonSlug] = useState("");
  const [googlePlaceId, setGooglePlaceId] = useState("");
  const [saving, setSaving] = useState(false);

  const fetchMerchant = useCallback(async () => {
    setLoading(true);
    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const { data } = await supabase
        .from("merchants")
        .select("*")
        .eq("user_id", user.id)
        .single();

      if (data) {
        setMerchant(data as Merchant);
        setSalonName(data.name);
        setSalonAddress(data.address ?? "");
        setSalonPhone(data.phone ?? "");
        setSalonEmail(data.email);
        setSalonSlug(data.slug);
        setGooglePlaceId(data.google_place_id ?? "");
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMerchant();
  }, [fetchMerchant]);

  const saveMerchant = async (updates: Partial<Merchant>) => {
    if (!merchant) return;
    const supabase = createClient();
    await supabase.from("merchants").update(updates).eq("id", merchant.id);
    setMerchant((prev) => (prev ? { ...prev, ...updates } : prev));
  };

  const handleSaveSalon = async () => {
    setSaving(true);
    try {
      await saveMerchant({
        name: salonName.trim(),
        address: salonAddress.trim() || null,
        phone: salonPhone.trim() || null,
        email: salonEmail.trim(),
        slug: salonSlug.trim(),
        google_place_id: googlePlaceId.trim() || null,
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <h1 className="text-2xl font-bold text-gray-900 mb-4">Paramètres</h1>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200 mb-6 overflow-x-auto">
        {TABS.map((t) => (
          <button
            key={t.value}
            onClick={() => setTab(t.value)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px whitespace-nowrap ${
              tab === t.value
                ? "border-indigo-600 text-indigo-600"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            {t.icon}
            {t.label}
          </button>
        ))}
      </div>

      {/* ---- Onglet Mon salon ---- */}
      {tab === "salon" && (
        <div className="max-w-2xl space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Informations du salon</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Nom du salon
                  </label>
                  <Input value={salonName} onChange={(e) => setSalonName(e.target.value)} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Slug (URL)
                  </label>
                  <Input value={salonSlug} onChange={(e) => setSalonSlug(e.target.value)} />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Adresse
                </label>
                <Input
                  value={salonAddress}
                  onChange={(e) => setSalonAddress(e.target.value)}
                  placeholder="123 Rue de la Paix, 75001 Paris"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Téléphone
                  </label>
                  <Input
                    value={salonPhone}
                    onChange={(e) => setSalonPhone(e.target.value)}
                    placeholder="+33 1 23 45 67 89"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Email
                  </label>
                  <Input
                    value={salonEmail}
                    onChange={(e) => setSalonEmail(e.target.value)}
                    type="email"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Google Place ID
                </label>
                <Input
                  value={googlePlaceId}
                  onChange={(e) => setGooglePlaceId(e.target.value)}
                  placeholder="ChIJ..."
                />
                <p className="text-xs text-gray-400 mt-1">
                  Utilisé pour les demandes automatiques d&apos;avis Google
                </p>
              </div>
            </CardContent>
          </Card>

          <div className="flex justify-end">
            <Button onClick={handleSaveSalon} disabled={saving} className="gap-2">
              <Save className="h-4 w-4" />
              {saving ? "Enregistrement..." : "Sauvegarder"}
            </Button>
          </div>
        </div>
      )}

      {/* ---- Onglet IA & Canaux ---- */}
      {tab === "ia" && merchant && (
        <div className="max-w-2xl">
          <AiConfig merchant={merchant} onSave={saveMerchant} />
        </div>
      )}

      {/* ---- Onglets futurs (stubs visuels) ---- */}
      {tab === "paiements" && (
        <div className="max-w-2xl space-y-4">
          <ComingSoonCard title="Stripe Connect, pourboires nominatifs, forfaits & abonnements clients" phase="en Phase 6" />
        </div>
      )}

      {tab === "site" && (
        <div className="max-w-2xl space-y-4">
          <ComingSoonCard title="Site de réservation public avec URL personnalisable et QR code" phase="en Phase 10" />
        </div>
      )}

      {tab === "fidelite" && (
        <div className="max-w-2xl space-y-4">
          <ComingSoonCard title="Programme fidélité avec points, paliers Bronze/Silver/Gold et récompenses" phase="en Phase 7" />
        </div>
      )}

      {tab === "equipe" && (
        <div className="max-w-2xl space-y-4">
          <ComingSoonCard title="Gestion des accès et rôles (Propriétaire, Manager, Praticien)" phase="prochainement" />
        </div>
      )}

      {tab === "abonnement" && merchant && (
        <div className="max-w-2xl">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Mon abonnement</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between py-3 border-b border-gray-100">
                <div>
                  <p className="font-medium text-gray-900">
                    AurA Pro — {merchant.seat_count} siège{merchant.seat_count > 1 ? "s" : ""}
                  </p>
                  <p className="text-sm text-gray-500">
                    {merchant.voice_enabled ? "Option Tél. IA incluse" : "Sans option Tél. IA"}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-lg font-bold text-indigo-600">
                    {merchant.seat_count <= 1
                      ? "16,90"
                      : merchant.seat_count <= 3
                        ? "31,90"
                        : "54,90"}{" "}
                    €/mois
                  </p>
                </div>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-500">Statut</span>
                <span className="text-green-600 font-medium bg-green-50 px-2 py-0.5 rounded-full">
                  Actif
                </span>
              </div>
              {merchant.stripe_subscription_id && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-500">ID abonnement</span>
                  <span className="text-gray-700 font-mono text-xs">
                    {merchant.stripe_subscription_id}
                  </span>
                </div>
              )}
              <div className="pt-2 flex gap-2">
                <Button variant="outline" size="sm">
                  Changer de plan
                </Button>
                <Button variant="outline" size="sm" className="text-red-600 hover:text-red-700">
                  Annuler l&apos;abonnement
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
};

export default SettingsPage;
