import type { MessageChannel } from "@/types/supabase";

/**
 * Unified message format sent to n8n for processing.
 * All channels normalize to this shape.
 */
export interface NormalizedMessage {
  channel: MessageChannel;
  sender_id: string;
  sender_name: string | null;
  message_text: string;
  message_id: string;
  timestamp: string;
  merchant_phone_id?: string;
}

/** Extract and normalize a WhatsApp Business API webhook payload */
export function normalizeWhatsApp(body: Record<string, unknown>): NormalizedMessage | null {
  try {
    const entry = (body.entry as Record<string, unknown>[])?.[0];
    const changes = (entry?.changes as Record<string, unknown>[])?.[0];
    const value = changes?.value as Record<string, unknown>;
    const messages = value?.messages as Record<string, unknown>[];
    const contacts = value?.contacts as Record<string, unknown>[];
    const metadata = value?.metadata as Record<string, unknown>;

    if (!messages?.length) return null;

    const msg = messages[0];
    const contact = contacts?.[0];
    const profile = contact?.profile as Record<string, unknown> | undefined;

    return {
      channel: "whatsapp",
      sender_id: msg.from as string,
      sender_name: (profile?.name as string) ?? null,
      message_text: ((msg.text as Record<string, unknown>)?.body as string) ?? "",
      message_id: msg.id as string,
      timestamp: msg.timestamp as string,
      merchant_phone_id: metadata?.phone_number_id as string,
    };
  } catch {
    return null;
  }
}

/** Extract and normalize a Messenger webhook payload */
export function normalizeMessenger(body: Record<string, unknown>): NormalizedMessage | null {
  try {
    const entry = (body.entry as Record<string, unknown>[])?.[0];
    const messaging = (entry?.messaging as Record<string, unknown>[])?.[0];
    const message = messaging?.message as Record<string, unknown>;
    const sender = messaging?.sender as Record<string, unknown>;

    if (!message?.text) return null;

    return {
      channel: "messenger",
      sender_id: sender?.id as string,
      sender_name: null,
      message_text: message.text as string,
      message_id: message.mid as string,
      timestamp: String(messaging?.timestamp ?? Date.now()),
    };
  } catch {
    return null;
  }
}

/** Extract and normalize a Telegram Bot API webhook payload */
export function normalizeTelegram(body: Record<string, unknown>): NormalizedMessage | null {
  try {
    const message = body.message as Record<string, unknown>;
    if (!message?.text) return null;

    const from = message.from as Record<string, unknown>;
    const chat = message.chat as Record<string, unknown>;

    return {
      channel: "telegram",
      sender_id: String(chat?.id ?? from?.id),
      sender_name: [from?.first_name, from?.last_name].filter(Boolean).join(" ") || null,
      message_text: message.text as string,
      message_id: String(message.message_id),
      timestamp: String(message.date ?? Math.floor(Date.now() / 1000)),
    };
  } catch {
    return null;
  }
}

/** Extract and normalize a Telnyx SMS webhook payload */
export function normalizeTelnyxSMS(body: Record<string, unknown>): NormalizedMessage | null {
  try {
    const data = body.data as Record<string, unknown>;
    if (!data) return null;

    const eventType = data.event_type as string;
    if (eventType !== "message.received") return null;

    const payload = data.payload as Record<string, unknown>;
    const from = payload?.from as Record<string, unknown>;
    const phoneNumber = from?.phone_number as string | undefined;
    if (!phoneNumber) return null;

    return {
      channel: "sms",
      sender_id: phoneNumber,
      sender_name: null,
      message_text: (payload?.text as string) ?? "",
      message_id: data.id as string,
      timestamp: (data.occurred_at as string) ?? new Date().toISOString(),
    };
  } catch {
    return null;
  }
}
