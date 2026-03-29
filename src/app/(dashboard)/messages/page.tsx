"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { MessageSquare, Phone, MessageCircle, Send, PhoneCall, Search, Bot } from "lucide-react";
import { Input } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/client";
import ConversationView from "@/components/messages/conversation-view";
import type { Database } from "@/types/supabase";

// --- Types ---

type Channel = Database["public"]["Tables"]["conversations"]["Row"]["channel"];

interface ClientInfo {
  id: string;
  name: string | null;
  phone: string | null;
}

interface ConversationRow {
  id: string;
  merchant_id: string;
  client_id: string;
  channel: Channel;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface ConversationWithClient extends ConversationRow {
  client: ClientInfo | null;
  last_message: string | null;
  last_message_at: string | null;
  unread_count: number;
}

type ChannelFilter = "all" | Channel;

// --- Helpers ---

const channelConfig: Record<
  Channel,
  { label: string; color: string; icon: React.ReactNode }
> = {
  whatsapp: {
    label: "WhatsApp",
    color: "text-green-600",
    icon: <MessageSquare className="w-4 h-4 text-green-500" />,
  },
  sms: {
    label: "SMS",
    color: "text-gray-600",
    icon: <Phone className="w-4 h-4 text-gray-500" />,
  },
  messenger: {
    label: "Messenger",
    color: "text-blue-600",
    icon: <MessageCircle className="w-4 h-4 text-blue-500" />,
  },
  telegram: {
    label: "Telegram",
    color: "text-sky-600",
    icon: <Send className="w-4 h-4 text-sky-500" />,
  },
  voice: {
    label: "Téléphone IA",
    color: "text-purple-600",
    icon: <PhoneCall className="w-4 h-4 text-purple-500" />,
  },
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

const formatRelativeTime = (iso: string | null): string => {
  if (!iso) return "";
  const now = Date.now();
  const diff = now - new Date(iso).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "à l'instant";
  if (minutes < 60) return `il y a ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `il y a ${hours}h`;
  return new Date(iso).toLocaleDateString("fr-FR", { day: "2-digit", month: "short" });
};

const CHANNEL_FILTERS: { value: ChannelFilter; label: string }[] = [
  { value: "all", label: "Tous" },
  { value: "whatsapp", label: "WhatsApp" },
  { value: "sms", label: "SMS" },
  { value: "voice", label: "Téléphone IA" },
  { value: "messenger", label: "Messenger" },
];

// --- Component ---

const MessagesPage = () => {
  const [conversations, setConversations] = useState<ConversationWithClient[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [channelFilter, setChannelFilter] = useState<ChannelFilter>("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const supabase = useMemo(() => createClient(), []);

  const fetchConversations = useCallback(async () => {
    setLoading(true);
    try {
      let query = supabase
        .from("conversations")
        .select(
          `
          *,
          client:clients(id, name, phone)
          `,
        )
        .order("updated_at", { ascending: false });

      if (channelFilter !== "all") {
        query = query.eq("channel", channelFilter);
      }

      const { data, error } = await query;

      if (error || !data) {
        setLoading(false);
        return;
      }

      // Fetch last messages for all conversations
      const convIds = data.map((c) => c.id);
      let lastMessages: Array<{ conversation_id: string; content: string; created_at: string }> = [];

      if (convIds.length > 0) {
        const { data: msgs } = await supabase
          .from("messages")
          .select("conversation_id, content, created_at")
          .in("conversation_id", convIds)
          .order("created_at", { ascending: false });

        if (msgs) {
          const seen = new Set<string>();
          for (const m of msgs) {
            if (!seen.has(m.conversation_id)) {
              seen.add(m.conversation_id);
              lastMessages.push(m);
            }
          }
        }
      }

      const lastMsgMap = new Map(
        lastMessages.map((m) => [m.conversation_id, { content: m.content, at: m.created_at }]),
      );

      type ConvQueryRow = typeof data[number];

      const enriched: ConversationWithClient[] = (data as ConvQueryRow[]).map((c) => {
        const lm = lastMsgMap.get(c.id);
        const clientData = c.client as ClientInfo | null;
        return {
          id: c.id,
          merchant_id: c.merchant_id,
          client_id: c.client_id,
          channel: c.channel as Channel,
          is_active: c.is_active,
          created_at: c.created_at,
          updated_at: c.updated_at,
          client: clientData,
          last_message: lm?.content ?? null,
          last_message_at: lm?.at ?? null,
          unread_count: 0,
        };
      });

      setConversations(enriched);
    } finally {
      setLoading(false);
    }
  }, [channelFilter, supabase]);

  useEffect(() => {
    fetchConversations();
  }, [fetchConversations]);

  const filtered = useMemo(() => conversations.filter((c) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return c.client?.name?.toLowerCase().includes(q) || c.client?.phone?.includes(q);
  }), [conversations, search]);

  const selectedConv = conversations.find((c) => c.id === selectedId) ?? null;

  return (
    <div className="flex h-full -m-6 overflow-hidden">
      {/* Colonne gauche — liste conversations */}
      <div className="w-80 flex-shrink-0 border-r border-gray-200 bg-white flex flex-col">
        {/* Entête */}
        <div className="p-4 border-b border-gray-100">
          <h1 className="text-lg font-bold text-gray-900 mb-3">Messages</h1>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher un client..."
              className="pl-9 text-sm"
            />
          </div>
        </div>

        {/* Filtres canaux */}
        <div className="flex gap-1 p-2 overflow-x-auto border-b border-gray-100 flex-shrink-0">
          {CHANNEL_FILTERS.map((f) => (
            <button
              key={f.value}
              onClick={() => setChannelFilter(f.value)}
              className={`px-2.5 py-1 text-xs rounded-full font-medium whitespace-nowrap transition-colors flex-shrink-0 ${
                channelFilter === f.value
                  ? "bg-indigo-600 text-white"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Liste */}
        <div className="flex-1 overflow-y-auto">
          {loading && (
            <div className="flex justify-center py-8">
              <div className="w-5 h-5 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
            </div>
          )}
          {!loading && filtered.length === 0 && (
            <p className="text-center text-sm text-gray-400 italic py-8">
              Aucune conversation
            </p>
          )}
          {filtered.map((conv) => {
            const cfg = channelConfig[conv.channel];
            const isSelected = selectedId === conv.id;
            return (
              <button
                key={conv.id}
                onClick={() => setSelectedId(conv.id)}
                className={`w-full flex items-start gap-3 px-4 py-3 text-left border-b border-gray-50 transition-colors ${
                  isSelected
                    ? "bg-indigo-50 border-l-2 border-l-indigo-600"
                    : "hover:bg-gray-50"
                }`}
              >
                {/* Avatar */}
                <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center flex-shrink-0">
                  <span className="text-indigo-700 font-semibold text-sm">
                    {getInitials(conv.client?.name ?? null)}
                  </span>
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-1">
                    <p className="text-sm font-semibold text-gray-900 truncate">
                      {conv.client?.name ?? "Client inconnu"}
                    </p>
                    <span className="text-xs text-gray-400 flex-shrink-0">
                      {formatRelativeTime(conv.last_message_at ?? conv.updated_at)}
                    </span>
                  </div>
                  <div className="flex items-center gap-1 mt-0.5">
                    {cfg.icon}
                    <p className="text-xs text-gray-500 truncate flex-1">
                      {conv.last_message ?? (
                        <span className="italic">Nouvelle conversation</span>
                      )}
                    </p>
                    {conv.is_active && (
                      <span className="flex-shrink-0 w-2 h-2 rounded-full bg-green-400" title="IA active" />
                    )}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Colonne centrale — fil de conversation */}
      <div className="flex-1 flex flex-col min-w-0">
        <ConversationView conversationId={selectedId} />
      </div>

      {/* Colonne droite — info client */}
      <div className="w-72 flex-shrink-0 border-l border-gray-200 bg-gray-50 flex flex-col">
        {selectedConv ? (
          <div className="p-4">
            {/* Avatar + nom */}
            <div className="flex flex-col items-center gap-2 py-4 text-center">
              <div className="w-14 h-14 rounded-full bg-indigo-100 flex items-center justify-center">
                <span className="text-indigo-700 font-bold text-lg">
                  {getInitials(selectedConv.client?.name ?? null)}
                </span>
              </div>
              <div>
                <p className="font-semibold text-gray-900">
                  {selectedConv.client?.name ?? "Client inconnu"}
                </p>
                {selectedConv.client?.phone && (
                  <p className="text-sm text-gray-500">{selectedConv.client.phone}</p>
                )}
              </div>
            </div>

            {/* Infos canal */}
            <div className="mt-2 space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-500">Canal</span>
                <span className={`flex items-center gap-1.5 font-medium ${channelConfig[selectedConv.channel].color}`}>
                  {channelConfig[selectedConv.channel].icon}
                  {channelConfig[selectedConv.channel].label}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-500">Statut IA</span>
                <span className={`flex items-center gap-1.5 font-medium ${selectedConv.is_active ? "text-green-600" : "text-gray-400"}`}>
                  <Bot className="w-3.5 h-3.5" />
                  {selectedConv.is_active ? "Active" : "Suspendue"}
                </span>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <p className="text-sm text-gray-400 italic text-center px-4">
              Informations client
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default MessagesPage;
