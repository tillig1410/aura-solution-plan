"use client";

import { useEffect, useState, useCallback } from "react";
import {
  X,
  MessageSquare,
  Phone,
  CalendarPlus,
  Mic,
  Star,
  Package,
  ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";

// --- Types ---

interface Practitioner {
  id: string;
  name: string;
  color: string;
}

interface Service {
  id: string;
  name: string;
  price_cents: number;
  duration_minutes: number;
}

interface RecentBooking {
  id: string;
  starts_at: string;
  ends_at: string;
  status: "pending" | "confirmed" | "in_progress" | "completed" | "cancelled" | "no_show";
  source_channel: string;
  service: Service | null;
  practitioner: Practitioner | null;
}

interface PackageInfo {
  id: string;
  name: string;
  total_uses: number;
  price_cents: number;
}

interface ActivePackage {
  id: string;
  remaining_uses: number;
  purchased_at: string;
  expires_at: string | null;
  package: PackageInfo | null;
}

interface ClientDetail {
  id: string;
  merchant_id: string;
  name: string | null;
  phone: string | null;
  email: string | null;
  whatsapp_id: string | null;
  messenger_id: string | null;
  telegram_id: string | null;
  preferred_practitioner_id: string | null;
  preferred_service_id: string | null;
  preferred_language: string;
  loyalty_points: number;
  loyalty_tier: string;
  no_show_count: number;
  is_blocked: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
  recent_bookings: RecentBooking[];
  active_packages: ActivePackage[];
}

interface ClientDetailProps {
  clientId: string | null;
  onClose: () => void;
}

// --- Helpers ---

const loyaltyConfig: Record<string, { label: string; color: string; dot: string }> = {
  gold: { label: "Gold", color: "text-yellow-600 bg-yellow-50 border-yellow-200", dot: "🟡" },
  silver: { label: "Silver", color: "text-gray-500 bg-gray-50 border-gray-200", dot: "⬜" },
  bronze: { label: "Bronze", color: "text-amber-700 bg-amber-50 border-amber-200", dot: "🟤" },
};

const statusLabels: Record<string, { label: string; color: string }> = {
  pending: { label: "En attente", color: "text-yellow-600 bg-yellow-50" },
  confirmed: { label: "Confirmé", color: "text-blue-600 bg-blue-50" },
  in_progress: { label: "En cours", color: "text-indigo-600 bg-indigo-50" },
  completed: { label: "Terminé", color: "text-green-600 bg-green-50" },
  cancelled: { label: "Annulé", color: "text-red-500 bg-red-50" },
  no_show: { label: "Absent", color: "text-gray-500 bg-gray-100" },
};

const channelIcons: Record<string, string> = {
  whatsapp: "WhatsApp",
  sms: "SMS",
  messenger: "Messenger",
  telegram: "Telegram",
  voice: "Téléphone",
  dashboard: "Dashboard",
  booking_page: "Réservation en ligne",
};

const getInitials = (name: string | null): string => {
  if (!name) return "?";
  return name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
};

const formatDate = (iso: string): string => {
  return new Date(iso).toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

const formatTime = (iso: string): string => {
  return new Date(iso).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
};

// --- Component ---

const ClientDetail = ({ clientId, onClose }: ClientDetailProps) => {
  const [client, setClient] = useState<ClientDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingNotes, setEditingNotes] = useState(false);
  const [notes, setNotes] = useState("");
  const [savingNotes, setSavingNotes] = useState(false);

  const fetchClient = useCallback(async (id: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/v1/clients/${id}`);
      if (!res.ok) {
        const body = (await res.json()) as { error?: string };
        throw new Error(body.error ?? "Erreur inconnue");
      }
      const data = (await res.json()) as ClientDetail;
      setClient(data);
      setNotes(data.notes ?? "");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur lors du chargement");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (clientId) {
      fetchClient(clientId);
    } else {
      setClient(null);
    }
  }, [clientId, fetchClient]);

  const saveNotes = async () => {
    if (!client) return;
    setSavingNotes(true);
    try {
      const res = await fetch(`/api/v1/clients/${client.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notes }),
      });
      if (res.ok) {
        const updated = (await res.json()) as ClientDetail;
        setClient((prev) => (prev ? { ...prev, notes: updated.notes } : prev));
        setEditingNotes(false);
      }
    } finally {
      setSavingNotes(false);
    }
  };

  if (!clientId) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/20 z-40"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Slide-over panel */}
      <aside className="fixed right-0 top-0 h-full w-96 bg-white shadow-2xl z-50 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="font-semibold text-gray-900">Fiche client</h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-md hover:bg-gray-100 text-gray-500"
            aria-label="Fermer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {loading && (
            <div className="flex items-center justify-center h-48">
              <div className="w-8 h-8 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
            </div>
          )}

          {error && (
            <div className="m-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              {error}
            </div>
          )}

          {client && !loading && (
            <div className="p-4 space-y-6">
              {/* En-tête client */}
              <div className="flex items-start gap-4">
                <div className="w-14 h-14 rounded-full bg-indigo-100 flex items-center justify-center flex-shrink-0">
                  <span className="text-indigo-700 font-bold text-lg">
                    {getInitials(client.name)}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-gray-900 text-lg truncate">
                    {client.name ?? "Client anonyme"}
                  </h3>
                  {client.phone && (
                    <p className="text-sm text-gray-500">{client.phone}</p>
                  )}
                  {client.email && (
                    <p className="text-sm text-gray-500 truncate">{client.email}</p>
                  )}
                  {/* Badge fidélité */}
                  {client.loyalty_tier && loyaltyConfig[client.loyalty_tier] && (
                    <div className="mt-1.5 flex items-center gap-1.5">
                      <span
                        className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full border ${loyaltyConfig[client.loyalty_tier].color}`}
                      >
                        {loyaltyConfig[client.loyalty_tier].dot}{" "}
                        {loyaltyConfig[client.loyalty_tier].label}
                      </span>
                      <span className="text-xs text-gray-400">
                        {client.loyalty_points} pts
                      </span>
                    </div>
                  )}
                  {client.is_blocked && (
                    <span className="inline-flex items-center text-xs font-medium px-2 py-0.5 rounded-full bg-red-50 text-red-700 border border-red-200 mt-1">
                      Bloqué
                    </span>
                  )}
                </div>
              </div>

              {/* Boutons d'action */}
              <div className="flex gap-2">
                <Button size="sm" className="flex-1 gap-1.5">
                  <CalendarPlus className="w-4 h-4" />
                  Nouveau RDV
                </Button>
                {client.whatsapp_id && (
                  <Button size="sm" variant="outline" className="gap-1.5 text-green-600 border-green-200 hover:bg-green-50">
                    <MessageSquare className="w-4 h-4" />
                    WhatsApp
                  </Button>
                )}
                {client.phone && (
                  <Button size="sm" variant="outline" className="gap-1.5">
                    <Phone className="w-4 h-4" />
                  </Button>
                )}
              </div>

              {/* Section Informations */}
              <section>
                <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
                  Informations
                </h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Inscrit le</span>
                    <span className="text-gray-900 font-medium">
                      {formatDate(client.created_at)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Langue</span>
                    <span className="text-gray-900 font-medium uppercase">
                      {client.preferred_language}
                    </span>
                  </div>
                  {client.no_show_count > 0 && (
                    <div className="flex justify-between">
                      <span className="text-gray-500">Absences</span>
                      <span className="text-red-600 font-medium">
                        {client.no_show_count}x
                      </span>
                    </div>
                  )}
                </div>

                {/* Notes inline */}
                <div className="mt-3">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-medium text-gray-500">Notes</span>
                    {!editingNotes && (
                      <button
                        onClick={() => setEditingNotes(true)}
                        className="text-xs text-indigo-600 hover:underline"
                      >
                        Modifier
                      </button>
                    )}
                  </div>
                  {editingNotes ? (
                    <div className="space-y-2">
                      <textarea
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        rows={3}
                        className="w-full text-sm border border-gray-200 rounded-lg p-2 resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        placeholder="Ajouter une note..."
                      />
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          onClick={saveNotes}
                          disabled={savingNotes}
                          className="text-xs"
                        >
                          {savingNotes ? "Enregistrement..." : "Enregistrer"}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setEditingNotes(false);
                            setNotes(client.notes ?? "");
                          }}
                          className="text-xs"
                        >
                          Annuler
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-gray-600 bg-gray-50 rounded-lg p-2 min-h-[2.5rem]">
                      {client.notes ?? (
                        <span className="text-gray-400 italic">Aucune note</span>
                      )}
                    </p>
                  )}
                </div>
              </section>

              {/* Section Historique */}
              <section>
                <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
                  Historique des visites
                </h4>
                {client.recent_bookings.length === 0 ? (
                  <p className="text-sm text-gray-400 italic">Aucune visite enregistrée</p>
                ) : (
                  <div className="space-y-2">
                    {client.recent_bookings.slice(0, 5).map((booking) => {
                      const statusInfo = statusLabels[booking.status] ?? { label: booking.status, color: "text-gray-500 bg-gray-100" };
                      return (
                        <div
                          key={booking.id}
                          className="flex items-center gap-3 p-2.5 bg-gray-50 rounded-lg"
                        >
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900 truncate">
                              {booking.service?.name ?? "Service inconnu"}
                            </p>
                            <p className="text-xs text-gray-500">
                              {formatDate(booking.starts_at)} à {formatTime(booking.starts_at)}
                              {booking.practitioner && ` · ${booking.practitioner.name}`}
                            </p>
                          </div>
                          <div className="flex flex-col items-end gap-1 flex-shrink-0">
                            {booking.service?.price_cents !== undefined && (
                              <span className="text-xs font-semibold text-gray-700">
                                {(booking.service.price_cents / 100).toFixed(2)} €
                              </span>
                            )}
                            <span
                              className={`text-xs px-1.5 py-0.5 rounded font-medium ${statusInfo.color}`}
                            >
                              {statusInfo.label}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>

              {/* Section Forfaits */}
              {client.active_packages.length > 0 && (
                <section>
                  <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
                    Forfaits & Abonnements actifs
                  </h4>
                  <div className="space-y-2">
                    {client.active_packages.map((cp) => (
                      <div
                        key={cp.id}
                        className="flex items-center gap-3 p-2.5 bg-indigo-50 rounded-lg border border-indigo-100"
                      >
                        <Package className="w-4 h-4 text-indigo-500 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-indigo-900 truncate">
                            {cp.package?.name ?? "Forfait"}
                          </p>
                          {cp.expires_at && (
                            <p className="text-xs text-indigo-400">
                              Exp. {formatDate(cp.expires_at)}
                            </p>
                          )}
                        </div>
                        <span className="text-xs font-bold text-indigo-700 flex-shrink-0">
                          {cp.remaining_uses}/{cp.package?.total_uses ?? "?"} uses
                        </span>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {/* Section Paiements résumé */}
              <section>
                <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                  <Star className="w-3.5 h-3.5" />
                  Fidélité
                </h4>
                <div className="bg-gradient-to-r from-indigo-50 to-purple-50 rounded-lg p-3 flex items-center justify-between">
                  <div>
                    <p className="text-xs text-gray-500">Points cumulés</p>
                    <p className="text-2xl font-bold text-indigo-700">
                      {client.loyalty_points}
                    </p>
                  </div>
                  <ChevronRight className="w-5 h-5 text-indigo-300" />
                </div>
              </section>
            </div>
          )}
        </div>
      </aside>
    </>
  );
};

export default ClientDetail;
