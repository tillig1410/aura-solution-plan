import { describe, it, expect, vi } from "vitest";

/**
 * T062 — Unit tests: Tip attribution logic
 * Verifies that tips are correctly attributed to the named practitioner.
 */

// ---- Mock Supabase ----------------------------------------------------------

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn() },
}));

const { createClient } = await import("@/lib/supabase/server");
const { handlePaymentSucceeded } = await import("@/lib/stripe/handlers/payment-succeeded");

// ---- Helpers ----------------------------------------------------------------

function makePaymentIntent(overrides: Record<string, unknown> = {}) {
  return {
    id: "pi_test_123",
    amount: 3500, // 35.00€
    metadata: {
      merchant_id: "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
      booking_id: "b1b2c3d4-e5f6-7890-abcd-ef1234567891",
      client_id: "c1b2c3d4-e5f6-7890-abcd-ef1234567892",
      practitioner_id: "d1b2c3d4-e5f6-7890-abcd-ef1234567893",
      tip_amount_cents: "500", // 5.00€ tip
      ...overrides,
    },
  };
}

function makeMockSupabase() {
  const insertFn = vi.fn().mockReturnValue({
    select: vi.fn().mockReturnValue({
      single: vi.fn().mockResolvedValue({ data: { id: "tip-1" }, error: null }),
    }),
  });

  const updateFn = vi.fn().mockReturnValue({
    eq: vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({ error: null }),
    }),
  });

  return {
    from: vi.fn((table: string) => {
      if (table === "tips") return { insert: insertFn };
      if (table === "bookings") return { update: updateFn };
      return { insert: insertFn, update: updateFn };
    }),
    insertFn,
    updateFn,
  };
}

// ---- Tests ------------------------------------------------------------------

describe("handlePaymentSucceeded — attribution pourboire", () => {
  it("crée un tip attribué au bon practitioner_id", async () => {
    const mock = makeMockSupabase();
    vi.mocked(createClient).mockResolvedValue(
      mock as unknown as Awaited<ReturnType<typeof createClient>>,
    );

    const pi = makePaymentIntent();
    await handlePaymentSucceeded(pi, await createClient());

    // Vérifie que from("tips") a été appelé avec insert contenant le bon practitioner_id
    expect(mock.from).toHaveBeenCalledWith("tips");
    expect(mock.insertFn).toHaveBeenCalledWith(
      expect.objectContaining({
        practitioner_id: "d1b2c3d4-e5f6-7890-abcd-ef1234567893",
        amount_cents: 500,
        merchant_id: "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
        client_id: "c1b2c3d4-e5f6-7890-abcd-ef1234567892",
        booking_id: "b1b2c3d4-e5f6-7890-abcd-ef1234567891",
        stripe_payment_intent_id: "pi_test_123",
      }),
    );
  });

  it("ne crée pas de tip si tip_amount_cents est absent", async () => {
    const mock = makeMockSupabase();
    vi.mocked(createClient).mockResolvedValue(
      mock as unknown as Awaited<ReturnType<typeof createClient>>,
    );

    const pi = makePaymentIntent({ tip_amount_cents: undefined });
    delete (pi.metadata as Record<string, unknown>).tip_amount_cents;
    await handlePaymentSucceeded(pi, await createClient());

    // from("tips") ne devrait pas avoir été appelé avec insert
    const tipsCalls = mock.from.mock.calls.filter((c) => c[0] === "tips");
    expect(tipsCalls.length).toBe(0);
  });

  it("ne crée pas de tip si tip_amount_cents vaut 0", async () => {
    const mock = makeMockSupabase();
    vi.mocked(createClient).mockResolvedValue(
      mock as unknown as Awaited<ReturnType<typeof createClient>>,
    );

    const pi = makePaymentIntent({ tip_amount_cents: "0" });
    await handlePaymentSucceeded(pi, await createClient());

    const tipsCalls = mock.from.mock.calls.filter((c) => c[0] === "tips");
    expect(tipsCalls.length).toBe(0);
  });

  it("marque le booking comme payé", async () => {
    const mock = makeMockSupabase();
    vi.mocked(createClient).mockResolvedValue(
      mock as unknown as Awaited<ReturnType<typeof createClient>>,
    );

    const pi = makePaymentIntent();
    await handlePaymentSucceeded(pi, await createClient());

    expect(mock.from).toHaveBeenCalledWith("bookings");
  });
});
