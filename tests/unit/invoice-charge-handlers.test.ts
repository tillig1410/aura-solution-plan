import { describe, it, expect, vi } from "vitest";

/**
 * T074 — Unit tests: Stripe invoice + charge handlers
 * handleInvoicePaid, handleInvoicePaymentFailed, handleChargeRefunded, handleChargeDisputeCreated
 */

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn() },
}));

const { handleInvoicePaid, handleInvoicePaymentFailed } = await import(
  "@/lib/stripe/handlers/invoice-handlers"
);
const { handleChargeRefunded, handleChargeDisputeCreated } = await import(
  "@/lib/stripe/handlers/charge-handlers"
);

// ---- Helpers ----------------------------------------------------------------

const MERCHANT = "a1b2c3d4-e5f6-7890-abcd-ef1234567890";
const BOOKING  = "b1b2c3d4-e5f6-7890-abcd-ef1234567891";

function makeInvoice(overrides: Record<string, unknown> = {}) {
  return {
    id: "inv_test_123",
    subscription: "sub_test_456",
    metadata: null as Record<string, string> | null,
    billing_reason: "subscription_cycle",
    ...overrides,
  };
}

function makeChain(updateError: object | null = null) {
  const updateFn = vi.fn().mockReturnValue({
    eq: vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({ error: updateError }),
    }),
  });
  const from = vi.fn(() => ({ update: updateFn }));
  return { from, updateFn };
}

// ---- handleInvoicePaid ------------------------------------------------------

describe("handleInvoicePaid — facture payée", () => {
  it("met à jour le merchant updated_at pour un abonnement Plan SaaS", async () => {
    const { from, updateFn } = makeChain();

    await handleInvoicePaid(
      makeInvoice({ metadata: { source: "plan-saas" } }),
      { from } as never,
    );

    expect(from).toHaveBeenCalledWith("merchants");
    expect(updateFn).toHaveBeenCalledWith(expect.objectContaining({ updated_at: expect.any(String) }));
  });

  it("met à jour client_subscriptions.status = active pour un abonnement client", async () => {
    const { from, updateFn } = makeChain();

    await handleInvoicePaid(makeInvoice(), { from } as never);

    expect(from).toHaveBeenCalledWith("client_subscriptions");
    expect(updateFn).toHaveBeenCalledWith({ status: "active" });
  });

  it("ne fait rien si pas de subscription", async () => {
    const { from } = makeChain();

    await handleInvoicePaid(makeInvoice({ subscription: null }), { from } as never);

    expect(from).not.toHaveBeenCalled();
  });
});

// ---- handleInvoicePaymentFailed ---------------------------------------------

describe("handleInvoicePaymentFailed — échec paiement facture", () => {
  it("ne touche pas la BDD pour un abonnement Plan SaaS (log uniquement)", async () => {
    const { from } = makeChain();

    await handleInvoicePaymentFailed(
      makeInvoice({ metadata: { source: "plan-saas" } }),
      { from } as never,
    );

    expect(from).not.toHaveBeenCalled();
  });

  it("marque client_subscriptions.status = past_due pour un abonnement client", async () => {
    const { from, updateFn } = makeChain();

    await handleInvoicePaymentFailed(makeInvoice(), { from } as never);

    expect(from).toHaveBeenCalledWith("client_subscriptions");
    expect(updateFn).toHaveBeenCalledWith({ status: "past_due" });
  });

  it("ne fait rien si pas de subscription", async () => {
    const { from } = makeChain();

    await handleInvoicePaymentFailed(
      makeInvoice({ subscription: null }),
      { from } as never,
    );

    expect(from).not.toHaveBeenCalled();
  });
});

// ---- handleChargeRefunded ---------------------------------------------------

describe("handleChargeRefunded — remboursement", () => {
  it("annule le booking si metadata contient booking_id + merchant_id valides", async () => {
    const { from, updateFn } = makeChain();
    const charge = {
      id: "ch_test_123",
      payment_intent: "pi_test_456",
      amount_refunded: 3500,
      refunded: true,
      metadata: { booking_id: BOOKING, merchant_id: MERCHANT },
    };

    await handleChargeRefunded(charge, { from } as never);

    expect(from).toHaveBeenCalledWith("bookings");
    expect(updateFn).toHaveBeenCalledWith({ status: "cancelled" });
  });

  it("ne touche pas la BDD si metadata vide", async () => {
    const { from } = makeChain();
    const charge = {
      id: "ch_test_123",
      payment_intent: "pi_test_456",
      amount_refunded: 3500,
      refunded: true,
      metadata: null,
    };

    await handleChargeRefunded(charge, { from } as never);

    expect(from).not.toHaveBeenCalled();
  });

  it("ne touche pas la BDD si booking_id n'est pas un UUID", async () => {
    const { from } = makeChain();
    const charge = {
      id: "ch_test_123",
      payment_intent: null,
      amount_refunded: 1000,
      refunded: false,
      metadata: { booking_id: "not-uuid", merchant_id: MERCHANT },
    };

    await handleChargeRefunded(charge, { from } as never);

    expect(from).not.toHaveBeenCalled();
  });
});

// ---- handleChargeDisputeCreated ---------------------------------------------

describe("handleChargeDisputeCreated — litige", () => {
  it("log l'alerte critique sans modifier la BDD", async () => {
    const { from } = makeChain();
    const dispute = {
      id: "dp_test_123",
      charge: "ch_test_456",
      amount: 3500,
      reason: "fraudulent",
      status: "needs_response",
      metadata: null,
    };

    await handleChargeDisputeCreated(dispute, { from } as never);

    expect(from).not.toHaveBeenCalled();
  });
});
