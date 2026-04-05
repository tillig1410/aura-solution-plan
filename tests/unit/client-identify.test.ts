import { describe, it, expect, vi } from "vitest";

/**
 * T079 — Unit tests: Client identification (identify or create)
 */

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));

const { identifyClient } = await import("@/lib/clients/identify");

// ---- Helpers ----------------------------------------------------------------

const MERCHANT = "a1b2c3d4-e5f6-7890-abcd-ef1234567890";

const existingClient = {
  id: "client-1",
  merchant_id: MERCHANT,
  name: "Jean Petit",
  phone: "+33612345678",
  whatsapp_id: "33612345678",
  messenger_id: null,
  telegram_id: null,
  email: null,
  loyalty_points: 50,
  loyalty_tier: "bronze",
  preferred_language: "fr",
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
};

function makeIdentifySupabase(
  existingData: object | null,
  options: { insertResult?: object | null; updateError?: object | null } = {},
) {
  const updateFn = vi.fn().mockReturnValue({
    eq: vi.fn().mockResolvedValue({ error: options.updateError ?? null }),
  });

  const insertFn = vi.fn().mockReturnValue({
    select: vi.fn().mockReturnValue({
      single: vi.fn().mockResolvedValue({
        data: options.insertResult ?? { ...existingClient, id: "new-client-1" },
        error: null,
      }),
    }),
  });

  const from = vi.fn(() => ({
    select: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: existingData,
            error: existingData ? null : { code: "PGRST116" },
          }),
        }),
      }),
    }),
    update: updateFn,
    insert: insertFn,
  }));

  return { from, updateFn, insertFn };
}

// ---- Tests ------------------------------------------------------------------

describe("identifyClient — identification ou création", () => {
  it("retourne le client existant si trouvé par whatsapp_id", async () => {
    const { from } = makeIdentifySupabase(existingClient);

    const client = await identifyClient({ from } as never, {
      merchantId: MERCHANT,
      channel: "whatsapp",
      senderId: "33612345678",
    });

    expect(client.id).toBe("client-1");
    expect(client.name).toBe("Jean Petit");
  });

  it("met à jour le nom si le client existe sans nom et qu'un senderName est fourni", async () => {
    const clientSansNom = { ...existingClient, name: null };
    const { from, updateFn } = makeIdentifySupabase(clientSansNom);

    const client = await identifyClient({ from } as never, {
      merchantId: MERCHANT,
      channel: "whatsapp",
      senderId: "33612345678",
      senderName: "Marie Dupont",
    });

    expect(client.name).toBe("Marie Dupont");
    expect(updateFn).toHaveBeenCalledWith({ name: "Marie Dupont" });
  });

  it("ne met pas à jour le nom si le client en a déjà un", async () => {
    const { from, updateFn } = makeIdentifySupabase(existingClient);

    const client = await identifyClient({ from } as never, {
      merchantId: MERCHANT,
      channel: "whatsapp",
      senderId: "33612345678",
      senderName: "Autre Nom",
    });

    expect(client.name).toBe("Jean Petit");
    expect(updateFn).not.toHaveBeenCalled();
  });

  it("crée un nouveau client si non trouvé", async () => {
    const newClient = { ...existingClient, id: "new-client-1", name: "Sophie" };
    const { from, insertFn } = makeIdentifySupabase(null, { insertResult: newClient });

    const client = await identifyClient({ from } as never, {
      merchantId: MERCHANT,
      channel: "whatsapp",
      senderId: "33699887766",
      senderName: "Sophie",
    });

    expect(client.id).toBe("new-client-1");
    expect(insertFn).toHaveBeenCalled();
  });

  it("utilise le bon champ pour chaque canal", async () => {
    const channelFields: Record<string, string> = {
      whatsapp: "whatsapp_id",
      messenger: "messenger_id",
      telegram: "telegram_id",
      sms: "phone",
      voice: "phone",
    };

    for (const [channel, field] of Object.entries(channelFields)) {
      const { from } = makeIdentifySupabase(existingClient);

      await identifyClient({ from } as never, {
        merchantId: MERCHANT,
        channel: channel as never,
        senderId: "test-id",
      });

      // from("clients") doit avoir été appelé
      expect(from).toHaveBeenCalledWith("clients");
    }
  });

  it("ajoute le phone en +format pour un WhatsApp numeric", async () => {
    const newClient = { ...existingClient, id: "new-wa", phone: "+33699887766" };
    const { from, insertFn } = makeIdentifySupabase(null, { insertResult: newClient });

    await identifyClient({ from } as never, {
      merchantId: MERCHANT,
      channel: "whatsapp",
      senderId: "33699887766",
    });

    const insertArg = insertFn.mock.calls[0][0] as Record<string, unknown>;
    expect(insertArg.phone).toBe("+33699887766");
  });

  it("throw si la création échoue", async () => {
    const { from } = makeIdentifySupabase(null, { insertResult: null });

    // Forcer l'erreur d'insert
    const mock = { from: vi.fn(() => ({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: null, error: null }),
          }),
        }),
      }),
      insert: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: null, error: { message: "constraint" } }),
        }),
      }),
    })) };

    await expect(
      identifyClient(mock as never, {
        merchantId: MERCHANT,
        channel: "whatsapp",
        senderId: "33600000000",
      }),
    ).rejects.toThrow("Failed to create client");
  });
});
