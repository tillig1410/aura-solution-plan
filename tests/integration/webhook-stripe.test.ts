import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

/**
 * T061 — Integration tests: POST /api/v1/webhooks/stripe
 * Validates signature verification, idempotency, and event routing.
 */

// ---- Mock Stripe SDK --------------------------------------------------------

const mockConstructEvent = vi.fn();

vi.mock("stripe", () => {
  return {
    default: class Stripe {
      webhooks = {
        constructEvent: mockConstructEvent,
      };
    },
  };
});

vi.mock("@/lib/supabase/server", () => ({
  createAdminClient: vi.fn(),
}));

vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn() },
  webhookLog: { received: vi.fn(), forwarded: vi.fn(), invalidPayload: vi.fn() },
  securityLog: { signatureRejected: vi.fn() },
}));

vi.mock("@/lib/stripe/handlers/payment-succeeded", () => ({
  handlePaymentSucceeded: vi.fn().mockResolvedValue(undefined),
}));

const { createAdminClient } = await import("@/lib/supabase/server");
const { POST } = await import("@/app/api/v1/webhooks/stripe/route");
const { handlePaymentSucceeded } = await import("@/lib/stripe/handlers/payment-succeeded");

// ---- Helpers ----------------------------------------------------------------

function makeEvent(type: string, id = "evt_test_123", data: Record<string, unknown> = {}) {
  return {
    id,
    type,
    data: { object: { id: "pi_test", metadata: {}, ...data } },
  };
}

function stripeReq(body: string, sig = "t=123,v1=abc") {
  return new NextRequest("http://localhost/api/v1/webhooks/stripe", {
    method: "POST",
    body,
    headers: {
      "Content-Type": "application/json",
      "Stripe-Signature": sig,
    },
  });
}

function makeMockSupabase(existingEventIds: string[] = []) {
  const isDuplicate = existingEventIds.length > 0;

  // For stripe_events: select chain (idempotency check)
  const stripeEventsSelect = {
    select: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({
          data: isDuplicate ? { id: existingEventIds[0] } : null,
          error: isDuplicate ? null : { code: "PGRST116" },
        }),
      }),
    }),
    insert: vi.fn().mockResolvedValue({ error: null }),
  };

  // For other tables (subscriptions, merchants, etc.)
  const genericChain = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: null, error: null }),
  };

  return {
    from: vi.fn((table: string) => {
      if (table === "stripe_events") return stripeEventsSelect;
      return genericChain;
    }),
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }),
    },
  };
}

// ---- Tests ------------------------------------------------------------------

describe("POST /api/v1/webhooks/stripe — signature", () => {
  it("retourne 400 si la signature Stripe est invalide", async () => {
    mockConstructEvent.mockImplementation(() => {
      throw new Error("Invalid signature");
    });

    const res = await POST(stripeReq('{"test":true}', "invalid_sig"));
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string };
    expect(body.error).toContain("signature");
  });

  it("retourne 200 pour un event valide", async () => {
    const event = makeEvent("payment_intent.succeeded");
    mockConstructEvent.mockReturnValue(event);
    vi.mocked(createAdminClient).mockReturnValue(
      makeMockSupabase() as unknown as Awaited<ReturnType<typeof createClient>>,
    );

    const res = await POST(stripeReq(JSON.stringify(event)));
    expect(res.status).toBe(200);
  });
});

describe("POST /api/v1/webhooks/stripe — idempotency", () => {
  it("ignore un event déjà traité (idempotent)", async () => {
    const event = makeEvent("payment_intent.succeeded", "evt_duplicate");
    mockConstructEvent.mockReturnValue(event);
    vi.mocked(createAdminClient).mockReturnValue(
      makeMockSupabase(["evt_duplicate"]) as unknown as Awaited<ReturnType<typeof createClient>>,
    );

    const res = await POST(stripeReq(JSON.stringify(event)));
    expect(res.status).toBe(200);
    const body = (await res.json()) as { status: string };
    expect(body.status).toBe("already_processed");
  });
});

describe("POST /api/v1/webhooks/stripe — event routing", () => {
  beforeEach(() => {
    vi.mocked(createAdminClient).mockReturnValue(
      makeMockSupabase() as unknown as Awaited<ReturnType<typeof createClient>>,
    );
  });

  it("route payment_intent.succeeded vers handlePaymentSucceeded", async () => {
    const event = makeEvent("payment_intent.succeeded");
    mockConstructEvent.mockReturnValue(event);

    await POST(stripeReq(JSON.stringify(event)));
    expect(handlePaymentSucceeded).toHaveBeenCalledWith(event.data.object, expect.anything());
  });

  it("retourne 200 pour un event non géré (ack silencieux)", async () => {
    const event = makeEvent("charge.refunded");
    mockConstructEvent.mockReturnValue(event);

    const res = await POST(stripeReq(JSON.stringify(event)));
    expect(res.status).toBe(200);
  });
});
