import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * T078 — Unit tests: Channel message router (sendMessage)
 * Mock global fetch pour éviter les vrais appels API.
 */

const mockFetch = vi.fn();
global.fetch = mockFetch;

process.env.WHATSAPP_ACCESS_TOKEN = "wa_test_token";
process.env.WHATSAPP_PHONE_NUMBER_ID = "123456";
process.env.MESSENGER_PAGE_ACCESS_TOKEN = "msg_test_token";
process.env.TELEGRAM_BOT_TOKEN = "tg_test_token";
process.env.TELNYX_API_KEY = "telnyx_test_key";
process.env.TELNYX_FROM_NUMBER = "+33100000000";

const { sendMessage } = await import("@/lib/channels/send");

const MERCHANT = "a1b2c3d4-e5f6-7890-abcd-ef1234567890";

beforeEach(() => {
  mockFetch.mockReset();
});

// ---- Routing ----------------------------------------------------------------

describe("sendMessage — routage par canal", () => {
  it("route whatsapp vers l'API WhatsApp Business", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ messages: [{ id: "wamid_123" }] }),
    });

    const result = await sendMessage({
      channel: "whatsapp",
      recipientId: "33612345678",
      message: "Votre RDV est confirmé",
      merchantId: MERCHANT,
    });

    expect(result.success).toBe(true);
    expect(result.messageId).toBe("wamid_123");
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining("graph.facebook.com"),
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("route messenger vers l'API Messenger", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ message_id: "mid_456" }),
    });

    const result = await sendMessage({
      channel: "messenger",
      recipientId: "psid_789",
      message: "Rappel RDV demain",
      merchantId: MERCHANT,
    });

    expect(result.success).toBe(true);
    expect(result.messageId).toBe("mid_456");
  });

  it("route telegram vers l'API Telegram Bot", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ result: { message_id: 42 } }),
    });

    const result = await sendMessage({
      channel: "telegram",
      recipientId: "12345",
      message: "Bonjour",
      merchantId: MERCHANT,
    });

    expect(result.success).toBe(true);
    expect(result.messageId).toBe("42");
  });

  it("route sms vers Telnyx", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ data: { id: "sms_id_789" } }),
    });

    const result = await sendMessage({
      channel: "sms",
      recipientId: "+33612345678",
      message: "Code confirmation: 1234",
      merchantId: MERCHANT,
    });

    expect(result.success).toBe(true);
    expect(result.messageId).toBe("sms_id_789");
  });

  it("route voice vers SMS (fallback)", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ data: { id: "sms_voice_fallback" } }),
    });

    const result = await sendMessage({
      channel: "voice",
      recipientId: "+33612345678",
      message: "Rappel vocal",
      merchantId: MERCHANT,
    });

    expect(result.success).toBe(true);
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining("telnyx.com"),
      expect.anything(),
    );
  });

  it("retourne erreur pour un canal inconnu", async () => {
    const result = await sendMessage({
      channel: "pigeon" as never,
      recipientId: "abc",
      message: "test",
      merchantId: MERCHANT,
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain("Unknown channel");
  });
});

// ---- Erreurs API ------------------------------------------------------------

describe("sendMessage — gestion d'erreurs API", () => {
  it("retourne une erreur si WhatsApp API échoue", async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 401,
      json: () => Promise.resolve({ error: { message: "Invalid token" } }),
    });

    const result = await sendMessage({
      channel: "whatsapp",
      recipientId: "33612345678",
      message: "test",
      merchantId: MERCHANT,
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain("WhatsApp API error");
  });

  it("retourne une erreur si Telnyx API échoue", async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 500,
      json: () => Promise.resolve({}),
    });

    const result = await sendMessage({
      channel: "sms",
      recipientId: "+33612345678",
      message: "test",
      merchantId: MERCHANT,
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain("Telnyx API error");
  });
});
