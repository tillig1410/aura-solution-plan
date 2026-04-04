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
  ExternalLink,
  CheckCircle2,
  AlertCircle,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/client";
import AiConfig from "@/components/settings/ai-config";
import LoyaltyConfig from "@/components/settings/loyalty-config";
import PackagesConfig from "@/components/settings/packages-config";
import { generateQrCodeDataUrl } from "@/lib/utils/qr-code";
import { calculatePrice, formatEur } from "@/lib/stripe/pricing";
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

const SettingsContent = () => {
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

  // QR Code
  const [qrCodeSrc, setQrCodeSrc] = useState<string | null>(null);

  // Stripe Connect
  const [connectLoading, setConnectLoading] = useState(false);
  const [portalLoading, setPortalLoading] = useState(false);

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

  useEffect(() => {
    if (merchant?.slug) {
      generateQrCodeDataUrl(merchant.slug, 200).then(setQrCodeSrc).catch(() => setQrCodeSrc(null));
    }
  }, [merchant?.slug]);

  const saveMerchant = async (updates: Partial<Merchant>) => {
    if (!merchant) return;
    const supabase = createClient();
    const { error } = await supabase.from("merchants").update(updates).eq("id", merchant.id);
    if (error) {
      throw new Error(error.message);
    }
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
      toast.success("Salon sauvegardé");
    } catch {
      toast.error("Erreur lors de la sauvegarde");
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

      {/* ---- Onglet Paiements ---- */}
      {tab === "paiements" && merchant && (
        <div className="max-w-2xl space-y-6">
          {/* Stripe Connect */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <CreditCard className="h-4 w-4" />
                Stripe Connect
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {merchant.stripe_account_id ? (
                <>
                  <div className="flex items-center gap-2 p-3 bg-green-50 rounded-lg border border-green-100">
                    <CheckCircle2 className="h-5 w-5 text-green-600 flex-shrink-0" />
                    <div>
                      <p className="text-sm font-medium text-green-800">Compte Stripe connecté</p>
                      <p className="text-xs text-green-600 font-mono">{merchant.stripe_account_id}</p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1.5"
                      onClick={async () => {
                        try {
                          const res = await fetch("/api/v1/stripe/dashboard-link", { method: "POST" });
                          if (res.ok) {
                            const { url } = (await res.json()) as { url: string };
                            window.open(url, "_blank");
                          }
                        } catch {
                          toast.error("Impossible d'ouvrir le dashboard Stripe");
                        }
                      }}
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                      Dashboard Stripe
                    </Button>
                  </div>
                </>
              ) : (
                <>
                  <div className="flex items-center gap-2 p-3 bg-amber-50 rounded-lg border border-amber-100">
                    <AlertCircle className="h-5 w-5 text-amber-600 flex-shrink-0" />
                    <div>
                      <p className="text-sm font-medium text-amber-800">Compte non connecté</p>
                      <p className="text-xs text-amber-600">
                        Connectez votre compte Stripe pour recevoir des paiements et pourboires.
                      </p>
                    </div>
                  </div>
                  <Button
                    disabled={connectLoading}
                    className="gap-2"
                    onClick={async () => {
                      setConnectLoading(true);
                      try {
                        const res = await fetch("/api/v1/stripe/connect", { method: "POST" });
                        if (res.ok) {
                          const { onboardingUrl } = (await res.json()) as { onboardingUrl: string };
                          window.location.href = onboardingUrl;
                        } else {
                          toast.error("Erreur lors de la connexion Stripe");
                        }
                      } catch {
                        toast.error("Erreur réseau");
                      } finally {
                        setConnectLoading(false);
                      }
                    }}
                  >
                    {connectLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <CreditCard className="h-4 w-4" />
                    )}
                    Connecter Stripe
                  </Button>
                </>
              )}
            </CardContent>
          </Card>

          {/* Pourboires */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Pourboires nominatifs</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-600">
                Vos clients peuvent envoyer un pourboire au praticien de leur choix après chaque prestation.
                Les pourboires sont visibles dans la page Statistiques.
              </p>
              <div className="mt-3 flex items-center justify-between text-sm">
                <span className="text-gray-500">Statut</span>
                <span className={`font-medium ${merchant.stripe_account_id ? "text-green-600" : "text-gray-400"}`}>
                  {merchant.stripe_account_id ? "Actif (via Stripe Connect)" : "Inactif — connectez Stripe"}
                </span>
              </div>
            </CardContent>
          </Card>

          {/* Forfaits & Packs prépayés */}
          <PackagesConfig />
        </div>
      )}

      {tab === "site" && merchant && (
        <div className="max-w-2xl space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Globe className="h-4 w-4" />
                Site de réservation
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  URL de votre site
                </label>
                <div className="flex gap-2">
                  <Input
                    value={`${typeof window !== "undefined" ? window.location.origin : ""}/${merchant.slug}`}
                    readOnly
                    className="bg-gray-50 font-mono text-sm"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const url = `${window.location.origin}/${merchant.slug}`;
                      navigator.clipboard.writeText(url);
                      toast.success("Lien copié !");
                    }}
                  >
                    Copier
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => window.open(`/${merchant.slug}`, "_blank")}
                    className="gap-1"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                    Voir
                  </Button>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  QR Code
                </label>
                <div className="flex items-center gap-4">
                  {qrCodeSrc ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={qrCodeSrc}
                      alt="QR Code"
                      className="w-32 h-32 border border-gray-200 rounded"
                      width={128}
                      height={128}
                    />
                  ) : (
                    <div className="w-32 h-32 border border-gray-200 rounded flex items-center justify-center">
                      <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
                    </div>
                  )}
                  <div className="text-sm text-gray-500">
                    <p>Imprimez ce QR code et affichez-le dans votre salon.</p>
                    <p className="mt-1">Vos clients peuvent le scanner pour accéder directement à votre page de réservation.</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {tab === "fidelite" && merchant && (
        <div className="max-w-2xl space-y-6">
          <LoyaltyConfig />
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
                    {formatEur(calculatePrice(merchant.seat_count, merchant.voice_enabled ?? false))}/mois
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
                <Button
                  variant="outline"
                  size="sm"
                  disabled={portalLoading || !merchant.stripe_subscription_id}
                  onClick={async () => {
                    setPortalLoading(true);
                    try {
                      const res = await fetch("/api/v1/stripe/customer-portal", { method: "POST" });
                      if (res.ok) {
                        const { url } = (await res.json()) as { url: string };
                        window.location.href = url;
                      } else {
                        toast.error("Impossible d'ouvrir le portail Stripe");
                      }
                    } catch {
                      toast.error("Erreur réseau");
                    } finally {
                      setPortalLoading(false);
                    }
                  }}
                >
                  {portalLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  Gérer mon abonnement
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
};

export default SettingsContent;
