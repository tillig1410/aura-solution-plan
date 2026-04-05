import { describe, it, expect, vi } from "vitest";

/**
 * T073 — Unit tests: Stripe subscription handlers
 * handleSubscriptionUpdated + handleSubscriptionDeleted
 */

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn() },
}));

const { handleSubscriptionUpdated, handleSubscriptionDeleted } = await import(
  "@/lib/stripe/handlers/subscription-updated"
);

// ---- Helpers ----------------------------------------------------------------

const MERCHANT = "a1b2c3d4-e5f6-7890-abcd-ef1234567890";
const CLIENT   = "b1b2c3d4-e5f6-7890-abcd-ef1234567891";

function makeSub(overrides: Record<string, unknown> = {}) {
  return {
    id: "sub_test_123",
    status: "active",
    metadata: { merchant_id: MERCHANT, client_id: CLIENT },
    current_period_start: Math.floor(Date.now() / 1000),
    current_period_end: Math.floor(Date.now() / 1000) + 30 * 86400,
    ...overrides,
  };
}

function makeSubSupabase(existing: object | null, updateError: object | null = null) {
  const updateFn = vi.fn().mockReturnValue({
    eq: vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({ error: updateError }),
    }),
  });

  const from = vi.fn(() => ({
    select: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: existing, error: existing ? null : { code: "PGRST116" } }),
        }),
      }),
    }),
    update: updateFn,
  }));

  return { from, updateFn };
}

// ---- handleSubscriptionUpdated ----------------------------------------------

describe("handleSubscriptionUpdated — mise à jour abonnement", () => {
  it("met à jour le statut d'un abonnement actif", async () => {
    const existing = { id: "cs-1", updated_at: "2026-01-01T00:00:00Z" };
    const { from, updateFn } = makeSubSupabase(existing);

    await handleSubscriptionUpdated(makeSub(), { from } as never);

    expect(from).toHaveBeenCalledWith("client_subscriptions");
    expect(updateFn).toHaveBeenCalledWith(expect.objectContaining({ status: "active" }));
  });

  it("mappe trialing → active", async () => {
    const existing = { id: "cs-1", updated_at: "2026-01-01T00:00:00Z" };
    const { from, updateFn } = makeSubSupabase(existing);

    await handleSubscriptionUpdated(makeSub({ status: "trialing" }), { from } as never);

    expect(updateFn).toHaveBeenCalledWith(expect.objectContaining({ status: "active" }));
  });

  it("mappe canceled → cancelled", async () => {
    const existing = { id: "cs-1", updated_at: "2026-01-01T00:00:00Z" };
    const { from, updateFn } = makeSubSupabase(existing);

    await handleSubscriptionUpdated(makeSub({ status: "canceled" }), { from } as never);

    expect(updateFn).toHaveBeenCalledWith(expect.objectContaining({ status: "cancelled" }));
  });

  it("mappe past_due → past_due", async () => {
    const existing = { id: "cs-1", updated_at: "2026-01-01T00:00:00Z" };
    const { from, updateFn } = makeSubSupabase(existing);

    await handleSubscriptionUpdated(makeSub({ status: "past_due" }), { from } as never);

    expect(updateFn).toHaveBeenCalledWith(expect.objectContaining({ status: "past_due" }));
  });

  it("réinitialise current_period_uses quand la période change", async () => {
    const existing = { id: "cs-1", updated_at: "2020-01-01T00:00:00Z" }; // ancien
    const { from, updateFn } = makeSubSupabase(existing);

    await handleSubscriptionUpdated(makeSub(), { from } as never);

    expect(updateFn).toHaveBeenCalledWith(
      expect.objectContaining({ current_period_uses: 0 }),
    );
  });

  it("ne réinitialise pas current_period_uses si la période n'a pas changé", async () => {
    // updated_at dans le futur → periodStart > lastUpdate = false
    const existing = { id: "cs-1", updated_at: "2099-01-01T00:00:00Z" };
    const { from, updateFn } = makeSubSupabase(existing);

    await handleSubscriptionUpdated(makeSub(), { from } as never);

    const payload = updateFn.mock.calls[0][0] as Record<string, unknown>;
    expect(payload).not.toHaveProperty("current_period_uses");
  });

  it("early return si metadata manquante", async () => {
    const { from } = makeSubSupabase(null);

    await handleSubscriptionUpdated(makeSub({ metadata: {} }), { from } as never);

    expect(from).not.toHaveBeenCalled();
  });

  it("early return si UUIDs invalides", async () => {
    const { from } = makeSubSupabase(null);

    await handleSubscriptionUpdated(
      makeSub({ metadata: { merchant_id: "bad", client_id: "bad" } }),
      { from } as never,
    );

    expect(from).not.toHaveBeenCalled();
  });

  it("early return si abonnement introuvable en BDD", async () => {
    const { from, updateFn } = makeSubSupabase(null);

    await handleSubscriptionUpdated(makeSub(), { from } as never);

    expect(updateFn).not.toHaveBeenCalled();
  });
});

// ---- handleSubscriptionDeleted ----------------------------------------------

describe("handleSubscriptionDeleted — annulation abonnement", () => {
  it("marque l'abonnement comme cancelled", async () => {
    const { from, updateFn } = makeSubSupabase(null);

    await handleSubscriptionDeleted(makeSub(), { from } as never);

    expect(updateFn).toHaveBeenCalledWith({ status: "cancelled" });
  });

  it("early return si pas de merchant_id", async () => {
    const { from } = makeSubSupabase(null);

    await handleSubscriptionDeleted(makeSub({ metadata: {} }), { from } as never);

    expect(from).not.toHaveBeenCalled();
  });

  it("early return si merchant_id invalide", async () => {
    const { from } = makeSubSupabase(null);

    await handleSubscriptionDeleted(
      makeSub({ metadata: { merchant_id: "not-uuid" } }),
      { from } as never,
    );

    expect(from).not.toHaveBeenCalled();
  });
});
