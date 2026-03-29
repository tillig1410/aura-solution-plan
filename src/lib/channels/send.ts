import type { MessageChannel } from "@/types/supabase";

interface SendMessageParams {
  channel: MessageChannel;
  recipientId: string;
  message: string;
  merchantId: string;
}

interface ChannelResponse {
  success: boolean;
  messageId?: string;
  error?: string;
}

/**
 * Send a message to a client on their preferred channel.
 * Routes to the appropriate API (WhatsApp, Messenger, Telegram, Telnyx SMS/Voice).
 */
export async function sendMessage(params: SendMessageParams): Promise<ChannelResponse> {
  const { channel, recipientId, message } = params;

  switch (channel) {
    case "whatsapp":
      return sendWhatsApp(recipientId, message);
    case "messenger":
      return sendMessenger(recipientId, message);
    case "telegram":
      return sendTelegram(recipientId, message);
    case "sms":
      return sendSMS(recipientId, message);
    case "voice":
      // Voice channel: fall back to SMS for text responses
      return sendSMS(recipientId, message);
    default:
      return { success: false, error: `Unknown channel: ${channel}` };
  }
}

async function sendWhatsApp(recipientId: string, message: string): Promise<ChannelResponse> {
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
  if (!accessToken) return { success: false, error: "WHATSAPP_ACCESS_TOKEN not configured" };

  const response = await fetch(
    `https://graph.facebook.com/v18.0/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: recipientId,
        type: "text",
        text: { body: message },
      }),
    },
  );

  if (!response.ok) {
    const errBody = await response.json().catch(() => null);
    const detail = (errBody as Record<string, unknown>)?.error;
    const errMsg = typeof detail === "object" && detail !== null
      ? (detail as Record<string, unknown>).message ?? response.status
      : response.status;
    return { success: false, error: `WhatsApp API error: ${errMsg}` };
  }

  const data = await response.json();
  return { success: true, messageId: data.messages?.[0]?.id };
}

async function sendMessenger(recipientId: string, message: string): Promise<ChannelResponse> {
  const accessToken = process.env.MESSENGER_PAGE_ACCESS_TOKEN;
  if (!accessToken) return { success: false, error: "MESSENGER_PAGE_ACCESS_TOKEN not configured" };

  const response = await fetch(
    "https://graph.facebook.com/v18.0/me/messages",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        recipient: { id: recipientId },
        message: { text: message },
      }),
    },
  );

  if (!response.ok) {
    return { success: false, error: `Messenger API error: ${response.status}` };
  }

  const data = await response.json();
  return { success: true, messageId: data.message_id };
}

async function sendTelegram(recipientId: string, message: string): Promise<ChannelResponse> {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!botToken) return { success: false, error: "TELEGRAM_BOT_TOKEN not configured" };

  const response = await fetch(
    `https://api.telegram.org/bot${botToken}/sendMessage`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: recipientId,
        text: message,
      }),
    },
  );

  if (!response.ok) {
    return { success: false, error: `Telegram API error: ${response.status}` };
  }

  const data = await response.json();
  return { success: true, messageId: String(data.result?.message_id) };
}

async function sendSMS(recipientId: string, message: string): Promise<ChannelResponse> {
  const apiKey = process.env.TELNYX_API_KEY;
  if (!apiKey) return { success: false, error: "TELNYX_API_KEY not configured" };

  const response = await fetch("https://api.telnyx.com/v2/messages", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: process.env.TELNYX_FROM_NUMBER,
      to: recipientId,
      text: message,
    }),
  });

  if (!response.ok) {
    return { success: false, error: `Telnyx API error: ${response.status}` };
  }

  const data = await response.json();
  return { success: true, messageId: data.data?.id };
}
