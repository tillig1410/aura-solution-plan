"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Mic, Send, UserCheck, Bot } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/client";
import type { Database } from "@/types/supabase";

type MessageRow = Database["public"]["Tables"]["messages"]["Row"];

interface ConversationViewProps {
  conversationId: string | null;
}

const formatTime = (iso: string): string =>
  new Date(iso).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });

const ConversationView = ({ conversationId }: ConversationViewProps) => {
  const [messages, setMessages] = useState<MessageRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const [sending, setSending] = useState(false);
  const [aiActive, setAiActive] = useState(true);
  const bottomRef = useRef<HTMLDivElement>(null);
  const supabase = createClient();

  const fetchMessages = useCallback(
    async (convId: string) => {
      setLoading(true);
      const { data, error } = await supabase
        .from("messages")
        .select("*")
        .eq("conversation_id", convId)
        .order("created_at", { ascending: true });

      if (!error && data) {
        setMessages(data);
      }
      setLoading(false);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  useEffect(() => {
    if (!conversationId) {
      setMessages([]);
      return;
    }
    fetchMessages(conversationId);

    // Realtime subscription
    const channel = supabase
      .channel(`messages:${conversationId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          const newMsg = payload.new as MessageRow;
          setMessages((prev) => [...prev, newMsg]);
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId, fetchMessages]);

  // Scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = async () => {
    if (!inputValue.trim() || !conversationId || sending) return;
    setSending(true);
    const content = inputValue.trim();
    setInputValue("");

    const { error } = await supabase.from("messages").insert({
      conversation_id: conversationId,
      merchant_id: "", // sera récupéré via RLS côté serveur
      sender: "ai",
      content,
      is_voice_transcription: false,
    });

    if (error) {
      setInputValue(content);
    }
    setSending(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  if (!conversationId) {
    return (
      <div className="flex-1 flex items-center justify-center bg-gray-50">
        <div className="text-center text-gray-400">
          <Bot className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="text-sm">Sélectionnez une conversation</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col bg-white min-h-0">
      {/* Header conversation */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
        <div className="flex items-center gap-2">
          <div
            className={`flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full ${
              aiActive
                ? "bg-indigo-50 text-indigo-600 border border-indigo-200"
                : "bg-gray-100 text-gray-500 border border-gray-200"
            }`}
          >
            <Bot className="w-3.5 h-3.5" />
            IA {aiActive ? "active" : "suspendue"}
          </div>
        </div>
        <Button
          size="sm"
          variant="outline"
          className="gap-1.5 text-sm"
          onClick={() => setAiActive((v) => !v)}
        >
          <UserCheck className="w-4 h-4" />
          {aiActive ? "Reprendre en main" : "Rendre à l'IA"}
        </Button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-0">
        {loading && (
          <div className="flex justify-center py-8">
            <div className="w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {!loading && messages.length === 0 && (
          <div className="text-center text-gray-400 italic text-sm py-8">
            Aucun message dans cette conversation
          </div>
        )}

        {messages.map((msg) => {
          const isAi = msg.sender === "ai";
          return (
            <div
              key={msg.id}
              className={`flex flex-col gap-1 ${isAi ? "items-end" : "items-start"}`}
            >
              {/* Badge expéditeur */}
              <div className="flex items-center gap-1.5">
                {!isAi ? (
                  <span className="text-xs text-gray-400 flex items-center gap-0.5">
                    <span>👤</span> Client
                  </span>
                ) : (
                  <span className="text-xs text-indigo-400 flex items-center gap-0.5">
                    <span>🤖</span> IA
                  </span>
                )}
                <span className="text-xs text-gray-300">{formatTime(msg.created_at)}</span>
              </div>

              {/* Bulle */}
              <div
                className={`max-w-[75%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                  isAi
                    ? "bg-indigo-600 text-white rounded-tr-sm"
                    : "bg-gray-100 text-gray-800 rounded-tl-sm"
                }`}
              >
                {msg.is_voice_transcription && (
                  <div className="flex items-center gap-1.5 mb-1 opacity-70">
                    <Mic className="w-3.5 h-3.5" />
                    <span className="text-xs">Transcription vocale</span>
                  </div>
                )}
                <p>{msg.content}</p>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {/* Zone saisie */}
      <div className="border-t border-gray-100 p-3 bg-white">
        <div className="flex items-center gap-2">
          <Input
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Répondre manuellement..."
            className="flex-1"
            disabled={sending}
          />
          <Button
            onClick={handleSend}
            disabled={!inputValue.trim() || sending}
            size="sm"
            className="gap-1.5"
          >
            <Send className="w-4 h-4" />
            Envoyer
          </Button>
        </div>
        {!aiActive && (
          <p className="text-xs text-amber-600 mt-1.5 flex items-center gap-1">
            <UserCheck className="w-3.5 h-3.5" />
            Vous avez repris la main — l'IA ne répondra plus automatiquement
          </p>
        )}
      </div>
    </div>
  );
};

export default ConversationView;
