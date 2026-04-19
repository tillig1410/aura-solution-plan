"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter, usePathname } from "next/navigation";
import {
  Bell,
  Gift,
  CalendarClock,
  Star,
  X,
  AlertTriangle,
  Sparkles,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";

interface SidebarNotification {
  id: string;
  type: "tip" | "booking_change" | "no_show" | "loyalty_upgrade" | "reminder" | "new_client";
  title: string;
  description: string;
  action?: string;
  actionTarget?: "agenda" | "clients";
  actionDate?: string;
  timestamp: string;
  dismissed: boolean;
}

const NOTIF_ICON: Record<SidebarNotification["type"], { icon: React.ReactNode; color: string }> = {
  tip: { icon: <Gift className="h-4 w-4" />, color: "text-orange-500 bg-orange-50" },
  booking_change: { icon: <CalendarClock className="h-4 w-4" />, color: "text-blue-500 bg-blue-50" },
  no_show: { icon: <AlertTriangle className="h-4 w-4" />, color: "text-red-500 bg-red-50" },
  loyalty_upgrade: { icon: <Star className="h-4 w-4" />, color: "text-yellow-500 bg-yellow-50" },
  reminder: { icon: <Bell className="h-4 w-4" />, color: "text-indigo-500 bg-indigo-50" },
  new_client: { icon: <Sparkles className="h-4 w-4" />, color: "text-emerald-500 bg-emerald-50" },
};

const SidebarNotifications = () => {
  const router = useRouter();
  const pathname = usePathname();
  const [notifications, setNotifications] = useState<SidebarNotification[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchNotifications = useCallback(async () => {
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: merchant } = await supabase
        .from("merchants")
        .select("id")
        .eq("user_id", user.id)
        .single();
      if (!merchant) return;

      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);

      // Fetch recent tips (today)
      const { data: tips } = await supabase
        .from("tips")
        .select("id, amount_cents, client_id, practitioner_id, created_at, client:clients(name), practitioner:practitioners(name)")
        .eq("merchant_id", merchant.id)
        .gte("created_at", todayStart.toISOString())
        .order("created_at", { ascending: false })
        .limit(5);

      // Fetch recent booking changes (cancelled/no_show today)
      const { data: changes } = await supabase
        .from("bookings")
        .select("id, status, starts_at, updated_at, client:clients(name)")
        .eq("merchant_id", merchant.id)
        .in("status", ["cancelled", "no_show"])
        .gte("updated_at", todayStart.toISOString())
        .order("updated_at", { ascending: false })
        .limit(5);

      // Fetch recently rescheduled bookings (updated today, confirmed, updated_at != created_at)
      const { data: rescheduled } = await supabase
        .from("bookings")
        .select("id, status, starts_at, updated_at, created_at, client:clients(name)")
        .eq("merchant_id", merchant.id)
        .eq("status", "confirmed")
        .gte("updated_at", todayStart.toISOString())
        .order("updated_at", { ascending: false })
        .limit(5);

      // Fetch newly created clients today
      const { data: newClients } = await supabase
        .from("clients")
        .select("id, name, created_at, whatsapp_id, messenger_id, telegram_id, phone")
        .eq("merchant_id", merchant.id)
        .gte("created_at", todayStart.toISOString())
        .order("created_at", { ascending: false })
        .limit(5);

      const notifs: SidebarNotification[] = [];

      if (newClients) {
        for (const c of newClients) {
          const source = c.whatsapp_id
            ? "WhatsApp"
            : c.messenger_id
              ? "Messenger"
              : c.telegram_id
                ? "Telegram"
                : c.phone
                  ? "téléphone"
                  : "dashboard";
          notifs.push({
            id: `new-client-${c.id}`,
            type: "new_client",
            title: "Nouveau client",
            description: `${c.name ?? "Client anonyme"} — créé via ${source}`,
            action: "VOIR LA FICHE",
            actionTarget: "clients",
            timestamp: c.created_at,
            dismissed: false,
          });
        }
      }

      if (tips) {
        for (const tip of tips) {
          const clientName = (tip.client as { name: string | null } | null)?.name ?? "Un client";
          const pracName = (tip.practitioner as { name: string | null } | null)?.name ?? "un praticien";
          notifs.push({
            id: `tip-${tip.id}`,
            type: "tip",
            title: `Pourboire reçu`,
            description: `${clientName} a envoyé ${(tip.amount_cents / 100).toFixed(0)}€ pour ${pracName}`,
            action: "REMERCIER",
            timestamp: tip.created_at,
            dismissed: false,
          });
        }
      }

      if (changes) {
        for (const b of changes) {
          const clientName = (b.client as { name: string | null } | null)?.name ?? "Un client";
          const isCancelled = b.status === "cancelled";
          notifs.push({
            id: `change-${b.id}`,
            type: isCancelled ? "booking_change" : "no_show",
            title: isCancelled ? "RDV annulé" : "Client absent",
            description: `${clientName} — ${new Date(b.starts_at).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}`,
            action: "VOIR",
            actionDate: b.starts_at.slice(0, 10),
            timestamp: b.updated_at,
            dismissed: false,
          });
        }
      }

      // Confirmed bookings : nouveau (created today) OU déplacé (created earlier, updated today >60s after creation)
      if (rescheduled) {
        for (const b of rescheduled) {
          const created = new Date(b.created_at).getTime();
          const updated = new Date(b.updated_at).getTime();
          const createdToday = new Date(b.created_at) >= todayStart;
          const isReschedule = !createdToday && updated - created > 60_000;
          if (createdToday || isReschedule) {
            const clientName = (b.client as { name: string | null } | null)?.name ?? "Un client";
            notifs.push({
              id: `reschedule-${b.id}`,
              type: "booking_change",
              title: createdToday ? "RDV confirmé" : "RDV déplacé",
              description: `${clientName} → ${new Date(b.starts_at).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })} à ${new Date(b.starts_at).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}`,
              action: "VOIR",
              actionDate: b.starts_at.slice(0, 10),
              timestamp: createdToday ? b.created_at : b.updated_at,
              dismissed: false,
            });
          }
        }
      }

      // Sort by timestamp descending
      notifs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

      // Filter out dismissed notifications before setting state
      const dismissed = new Set(
        JSON.parse(sessionStorage.getItem("dismissed_notifs") || "[]") as string[]
      );
      setNotifications(notifs.filter((n) => !dismissed.has(n.id)).slice(0, 8));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchNotifications();
    // Refresh every 30 seconds
    const interval = setInterval(fetchNotifications, 30_000);
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  const dismiss = (id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
    const dismissed = JSON.parse(sessionStorage.getItem("dismissed_notifs") || "[]") as string[];
    if (!dismissed.includes(id)) {
      dismissed.push(id);
      sessionStorage.setItem("dismissed_notifs", JSON.stringify(dismissed));
    }
    // Extraire le booking_id si c'est une notif booking (change/reschedule)
    const bookingMatch = id.match(/^(?:change|reschedule)-(.+)$/);
    if (bookingMatch) {
      const bookingId = bookingMatch[1];
      // Si c'est une notif d'annulation/no-show, masquer aussi le RDV de l'agenda
      if (id.startsWith("change-")) {
        const hidden = JSON.parse(sessionStorage.getItem("agenda_hidden_bookings") || "[]") as string[];
        if (!hidden.includes(bookingId)) {
          hidden.push(bookingId);
          sessionStorage.setItem("agenda_hidden_bookings", JSON.stringify(hidden));
          window.dispatchEvent(new Event("agenda-hidden-bookings-changed"));
        }
      }
      // Clear le highlight si c'est ce booking qui était surligné
      const currentHighlight = sessionStorage.getItem("agenda_highlighted_booking");
      if (currentHighlight === bookingId) {
        sessionStorage.removeItem("agenda_highlighted_booking");
        window.dispatchEvent(new Event("agenda-highlighted-booking-changed"));
      }
    }
  };

  const activeNotifs = notifications.filter((n) => !n.dismissed);

  return (
    <div className="flex flex-col border-t">
      <div className="flex items-center gap-2 px-4 py-2.5">
        <Bell className="h-4 w-4 text-gray-500" />
        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
          Notifications
        </span>
        {activeNotifs.length > 0 && (
          <span className="ml-auto text-[10px] font-bold text-white bg-orange-500 rounded-full h-4 min-w-4 flex items-center justify-center px-1">
            {activeNotifs.length}
          </span>
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-3 pb-3 space-y-2 max-h-64">
        {loading && (
          <div className="flex justify-center py-4">
            <div className="w-4 h-4 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {!loading && activeNotifs.length === 0 && (
          <p className="text-xs text-gray-400 text-center py-3">Aucune notification</p>
        )}

        {!loading &&
          activeNotifs.map((notif) => {
            const config = NOTIF_ICON[notif.type];
            return (
              <div
                key={notif.id}
                className="rounded-lg border border-gray-100 bg-white p-2.5 relative group"
              >
                <button
                  onClick={() => dismiss(notif.id)}
                  className="absolute top-1.5 right-1.5 opacity-0 group-hover:opacity-100 transition-opacity text-gray-300 hover:text-gray-500"
                >
                  <X className="h-3 w-3" />
                </button>
                <div className="flex items-start gap-2">
                  <div className={`rounded-full p-1.5 shrink-0 ${config.color}`}>
                    {config.icon}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium text-gray-800">{notif.title}</p>
                    <p className="text-[10px] text-gray-500 mt-0.5 leading-relaxed">{notif.description}</p>
                    {notif.action && (
                      <button
                        className="text-[10px] font-semibold text-indigo-600 mt-1 hover:text-indigo-800"
                        onClick={() => {
                          if (notif.actionTarget === "clients") {
                            router.push("/clients");
                          } else if (notif.actionDate) {
                            // Navigate to agenda on the booking date
                            if (pathname === "/agenda") {
                              sessionStorage.setItem("agenda_goto_date", notif.actionDate);
                              window.dispatchEvent(new Event("agenda-goto-date"));
                            } else {
                              sessionStorage.setItem("agenda_goto_date", notif.actionDate);
                              router.push("/agenda");
                            }
                          }
                          // Highlight le booking sur l'agenda (extrait l'id depuis notif.id)
                          // Formats : "change-{bookingId}", "reschedule-{bookingId}", "tip-{tipId}", etc.
                          const match = notif.id.match(/^(?:change|reschedule)-(.+)$/);
                          if (match) {
                            const bookingId = match[1];
                            sessionStorage.setItem("agenda_highlighted_booking", bookingId);
                            window.dispatchEvent(new Event("agenda-highlighted-booking-changed"));
                          }
                          // NE PAS dismiss la notif ici — elle reste visible jusqu'au clic sur la croix
                        }}
                      >
                        {notif.action}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
      </div>
    </div>
  );
};

export default SidebarNotifications;
