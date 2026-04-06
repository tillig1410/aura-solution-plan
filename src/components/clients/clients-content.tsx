"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Search,
  Plus,
  MessageSquare,
  Phone,
  MessageCircle,
  Send,
  PhoneCall,
  Monitor,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import ClientDetail from "@/components/clients/client-detail";

// --- Types ---

interface ClientWithStats {
  id: string;
  name: string | null;
  phone: string | null;
  email: string | null;
  whatsapp_id: string | null;
  messenger_id: string | null;
  telegram_id: string | null;
  loyalty_tier: string;
  loyalty_points: number;
  is_blocked: boolean;
  created_at: string;
  booking_count: number;
  last_booking_at: string | null;
  next_booking_at: string | null;
}

interface ClientsResponse {
  data: ClientWithStats[];
  count: number;
  page: number;
  total_pages: number;
}

type FilterType = "all" | "loyal" | "new" | "inactive";

// --- Helpers ---

const getInitials = (name: string | null): string => {
  if (!name) return "?";
  return name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
};

const loyaltyBadge: Record<string, { dot: string; label: string; cls: string }> = {
  gold: { dot: "\u{1F7E1}", label: "Gold", cls: "text-yellow-600 bg-yellow-50 border-yellow-200" },
  silver: { dot: "\u2B1C", label: "Silver", cls: "text-gray-500 bg-gray-50 border-gray-200" },
  bronze: { dot: "\u{1F7E4}", label: "Bronze", cls: "text-amber-700 bg-amber-50 border-amber-200" },
};

const formatDate = (iso: string | null): string => {
  if (!iso) return "\u2014";
  return new Date(iso).toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

const ChannelIcon = ({ client }: { client: ClientWithStats }) => {
  if (client.whatsapp_id) return <MessageSquare className="w-4 h-4 text-green-500" aria-label="WhatsApp" />;
  if (client.messenger_id) return <MessageCircle className="w-4 h-4 text-blue-500" aria-label="Messenger" />;
  if (client.telegram_id) return <Send className="w-4 h-4 text-sky-500" aria-label="Telegram" />;
  if (client.phone) return <Phone className="w-4 h-4 text-gray-400" aria-label="SMS/Téléphone" />;
  return <Monitor className="w-4 h-4 text-gray-300" aria-label="Dashboard" />;
};

const FILTERS: { value: FilterType; label: string }[] = [
  { value: "all", label: "Tous" },
  { value: "loyal", label: "Fidèles" },
  { value: "new", label: "Nouveaux" },
  { value: "inactive", label: "Inactifs" },
];

// --- Component ---

const ClientsContent = () => {
  const [clients, setClients] = useState<ClientWithStats[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<FilterType>("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Dialog "Nouveau client"
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newNotes, setNewNotes] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchClients = useCallback(
    async (searchVal: string, filterVal: FilterType, pageVal: number) => {
      setLoading(true);
      try {
        const params = new URLSearchParams({
          search: searchVal,
          filter: filterVal,
          page: String(pageVal),
          limit: "20",
        });
        const res = await fetch(`/api/v1/clients?${params.toString()}`);
        if (!res.ok) return;
        const json = (await res.json()) as ClientsResponse;
        setClients(json.data);
        setTotal(json.count);
        setPage(json.page);
        setTotalPages(json.total_pages);
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  // Fetch on filter/page change only — search is debounced separately
  useEffect(() => {
    fetchClients(search, filter, page);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter, page, fetchClients]);

  const handleSearchChange = (value: string) => {
    setSearch(value);
    setPage(1);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      fetchClients(value, filter, 1);
    }, 300);
  };

  const handleFilterChange = (f: FilterType) => {
    setFilter(f);
    setPage(1);
  };

  const handleCreate = async () => {
    if (!newName.trim()) return;
    setCreating(true);
    setCreateError(null);
    try {
      const res = await fetch("/api/v1/clients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newName.trim(),
          phone: newPhone.trim() || undefined,
          email: newEmail.trim() || undefined,
          notes: newNotes.trim() || undefined,
        }),
      });
      const body = await res.json();
      if (!res.ok) {
        const errBody = body as { error?: string };
        setCreateError(errBody.error ?? "Erreur lors de la création");
        return;
      }
      setDialogOpen(false);
      setNewName("");
      setNewPhone("");
      setNewEmail("");
      setNewNotes("");
      fetchClients(search, filter, 1);
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="flex h-full relative">
      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Clients</h1>
            <p className="text-sm text-gray-500 mt-0.5">
              {total} client{total > 1 ? "s" : ""}
            </p>
          </div>
          <Button onClick={() => setDialogOpen(true)} className="gap-2">
            <Plus className="w-4 h-4" />
            Nouveau client
          </Button>
        </div>

        {/* Search + filtres */}
        <div className="flex items-center gap-3 mb-4">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              value={search}
              onChange={(e) => handleSearchChange(e.target.value)}
              placeholder="Rechercher par nom ou téléphone..."
              className="pl-9"
            />
          </div>
          <div className="flex items-center gap-1">
            {FILTERS.map((f) => (
              <button
                key={f.value}
                onClick={() => handleFilterChange(f.value)}
                className={`px-3 py-1.5 text-sm rounded-full font-medium transition-colors ${
                  filter === f.value
                    ? "bg-indigo-600 text-white"
                    : "bg-white text-gray-600 border border-gray-200 hover:bg-gray-50"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {/* Table */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden flex-1">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="text-left px-4 py-3 font-medium text-gray-500">Client</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">Téléphone</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">Dernière visite</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">Prochain RDV</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">Visites</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">Fidélité</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">Canal</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-gray-400">
                    <div className="flex justify-center">
                      <div className="w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
                    </div>
                  </td>
                </tr>
              )}
              {!loading && clients.length === 0 && (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-gray-400 italic">
                    Aucun client trouvé
                  </td>
                </tr>
              )}
              {!loading &&
                clients.map((client) => {
                  const badge = loyaltyBadge[client.loyalty_tier];
                  return (
                    <tr
                      key={client.id}
                      onClick={() => setSelectedId(client.id)}
                      className="border-b border-gray-50 hover:bg-indigo-50/40 cursor-pointer transition-colors"
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center flex-shrink-0">
                            <span className="text-indigo-700 font-semibold text-xs">
                              {getInitials(client.name)}
                            </span>
                          </div>
                          <div>
                            <p className="font-medium text-gray-900">
                              {client.name ?? "Anonyme"}
                            </p>
                            {client.email && (
                              <p className="text-xs text-gray-400 truncate max-w-[160px]">
                                {client.email}
                              </p>
                            )}
                          </div>
                          {client.is_blocked && (
                            <span className="text-xs bg-red-50 text-red-600 px-1.5 py-0.5 rounded border border-red-200">
                              Bloqué
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-gray-600">
                        {client.phone ?? "\u2014"}
                      </td>
                      <td className="px-4 py-3 text-gray-600">
                        {formatDate(client.last_booking_at)}
                      </td>
                      <td className="px-4 py-3">
                        {client.next_booking_at ? (
                          <span className="inline-flex items-center gap-1 text-xs font-medium text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-full border border-indigo-200">
                            {formatDate(client.next_booking_at)}
                          </span>
                        ) : (
                          <span className="text-gray-400 text-xs">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className="font-semibold text-gray-800">
                          {client.booking_count}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {badge ? (
                          <span
                            className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full border ${badge.cls}`}
                          >
                            {badge.dot} {badge.label}
                          </span>
                        ) : (
                          <span className="text-gray-400 text-xs">\u2014</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <ChannelIcon client={client} />
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between mt-4 text-sm text-gray-500">
            <span>
              Page {page} sur {totalPages}
            </span>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
              >
                Précédent
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                Suivant
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Panneau droit : détail client */}
      <ClientDetail clientId={selectedId} onClose={() => setSelectedId(null)} />

      {/* Dialog nouveau client */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nouveau client</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Nom <span className="text-red-500">*</span>
              </label>
              <Input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Prénom Nom"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Téléphone
              </label>
              <Input
                value={newPhone}
                onChange={(e) => setNewPhone(e.target.value)}
                placeholder="+33 6 12 34 56 78"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Email
              </label>
              <Input
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                placeholder="email@exemple.com"
                type="email"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Notes
              </label>
              <textarea
                value={newNotes}
                onChange={(e) => setNewNotes(e.target.value)}
                rows={2}
                className="w-full text-sm border border-gray-200 rounded-lg p-2 resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="Notes internes..."
              />
            </div>
            {createError && (
              <p className="text-sm text-red-600 bg-red-50 p-2 rounded border border-red-100">
                {createError}
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Annuler
            </Button>
            <Button
              onClick={handleCreate}
              disabled={creating || newName.trim().length < 2}
            >
              {creating ? "Création..." : "Créer le client"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ClientsContent;
