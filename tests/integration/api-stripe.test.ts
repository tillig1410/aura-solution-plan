import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

/**
 * Tests: POST /api/v1/stripe/connect + dashboard-link
 * customer-portal est exclu car il instancie Stripe au module level
 * et throw si STRIPE_SECRET_KEY absent — testé séparément si besoin.
 */

const mockUser = { id: "user-abc" };
const mockMerchant = {
  id: "merchant-123",
  name: "Salon Test",
  email: "salon@test.fr",
  stripe_account_id: null as string | null,
};

// ---- Mock Supabase + Stripe ------------------------------------------------

function buildChain(resolvedData: unknown, resolvedError: null | { message: string } = null) {
  const chain: Record<string, unknown> = {};
  for (const method of ["select", "eq", "update", "insert"]) {
    chain[method] = vi.fn().mockReturnValue(chain);
  }
  chain["single"] = vi.fn().mockResolvedValue({ data: resolvedData, error: resolvedError });
  chain["then"] = (onFulfilled: (v: { data: unknown; error: unknown }) => void) =>
    Promise.resolve({ data: resolvedData, error: resolvedError }).then(onFulfilled);
  return chain;
}

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn() },
}));
vi.mock("@/lib/stripe/connect", () => ({
  createConnectAccount: vi.fn(),
  createDashboardLink: vi.fn(),
}));

const { createClient } = await import("@/lib/supabase/server");
const { createConnectAccount, createDashboardLink } = await import("@/lib/stripe/connect");
const { POST: CONNECT } = await import("@/app/api/v1/stripe/connect/route");
const { POST: DASHBOARD } = await import("@/app/api/v1/stripe/dashboard-link/route");

// ---- Helpers ---------------------------------------------------------------

function postReq(url: string) {
  return new NextRequest(url, { method: "POST" });
}

function makeSb(merchant: unknown = mockMerchant) {
  return {
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: mockUser }, error: null }) },
    from: vi.fn((table: string) => {
      if (table === "merchants") return buildChain(merchant);
      return buildChain(null);
    }),
  };
}

// ---- POST /api/v1/stripe/connect -------------------------------------------

describe("POST /api/v1/stripe/connect — auth", () => {
  it("retourne 401 si non authentifié", async () => {
    vi.mocked(createClient).mockResolvedValueOnce({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }) },
      from: vi.fn(),
    } as unknown as Awaited<ReturnType<typeof createClient>>);

    const res = await CONNECT(postReq("http://localhost/api/v1/stripe/connect"));
    expect(res.status).toBe(401);
  });

  it("retourne 404 si merchant introuvable", async () => {
    vi.mocked(createClient).mockResolvedValueOnce({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: mockUser }, error: null }) },
      from: vi.fn(() => buildChain(null)),
    } as unknown as Awaited<ReturnType<typeof createClient>>);

    const res = await CONNECT(postReq("http://localhost/api/v1/stripe/connect"));
    expect(res.status).toBe(404);
  });
});

describe("POST /api/v1/stripe/connect — logique métier", () => {
  it("retourne 400 si stripe_account_id déjà existant", async () => {
    vi.mocked(createClient).mockResolvedValue(
      makeSb({ ...mockMerchant, stripe_account_id: "acct_existing" }) as unknown as Awaited<ReturnType<typeof createClient>>,
    );

    const res = await CONNECT(postReq("http://localhost/api/v1/stripe/connect"));
    expect(res.status).toBe(400);
    const body = await res.json() as { error: string };
    expect(body.error).toContain("already connected");
  });

  it("retourne 200 avec onboardingUrl si succès", async () => {
    vi.mocked(createClient).mockResolvedValue(
      makeSb({ ...mockMerchant, stripe_account_id: null }) as unknown as Awaited<ReturnType<typeof createClient>>,
    );
    vi.mocked(createConnectAccount).mockResolvedValue({
      accountId: "acct_new",
      onboardingUrl: "https://connect.stripe.com/setup/e/...",
    });

    const res = await CONNECT(postReq("http://localhost/api/v1/stripe/connect"));
    expect(res.status).toBe(200);
    const body = await res.json() as { onboardingUrl: string };
    expect(body.onboardingUrl).toContain("stripe.com");
  });

  it("retourne 500 si createConnectAccount throw", async () => {
    vi.mocked(createClient).mockResolvedValue(
      makeSb({ ...mockMerchant, stripe_account_id: null }) as unknown as Awaited<ReturnType<typeof createClient>>,
    );
    vi.mocked(createConnectAccount).mockRejectedValue(new Error("Stripe API error"));

    const res = await CONNECT(postReq("http://localhost/api/v1/stripe/connect"));
    expect(res.status).toBe(500);
  });
});

// ---- POST /api/v1/stripe/dashboard-link ------------------------------------

describe("POST /api/v1/stripe/dashboard-link — auth", () => {
  it("retourne 401 si non authentifié", async () => {
    vi.mocked(createClient).mockResolvedValueOnce({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }) },
      from: vi.fn(),
    } as unknown as Awaited<ReturnType<typeof createClient>>);

    const res = await DASHBOARD(postReq("http://localhost/api/v1/stripe/dashboard-link"));
    expect(res.status).toBe(401);
  });
});

describe("POST /api/v1/stripe/dashboard-link — logique métier", () => {
  it("retourne 400 si pas de stripe_account_id", async () => {
    vi.mocked(createClient).mockResolvedValue(
      makeSb({ ...mockMerchant, stripe_account_id: null }) as unknown as Awaited<ReturnType<typeof createClient>>,
    );

    const res = await DASHBOARD(postReq("http://localhost/api/v1/stripe/dashboard-link"));
    expect(res.status).toBe(400);
    const body = await res.json() as { error: string };
    expect(body.error).toContain("No Stripe account");
  });

  it("retourne 200 avec URL si succès", async () => {
    vi.mocked(createClient).mockResolvedValue(
      makeSb({ ...mockMerchant, stripe_account_id: "acct_123" }) as unknown as Awaited<ReturnType<typeof createClient>>,
    );
    vi.mocked(createDashboardLink).mockResolvedValue("https://dashboard.stripe.com/...");

    const res = await DASHBOARD(postReq("http://localhost/api/v1/stripe/dashboard-link"));
    expect(res.status).toBe(200);
    const body = await res.json() as { url: string };
    expect(body.url).toContain("stripe.com");
  });

  it("retourne 500 si createDashboardLink throw", async () => {
    vi.mocked(createClient).mockResolvedValue(
      makeSb({ ...mockMerchant, stripe_account_id: "acct_123" }) as unknown as Awaited<ReturnType<typeof createClient>>,
    );
    vi.mocked(createDashboardLink).mockRejectedValue(new Error("Stripe error"));

    const res = await DASHBOARD(postReq("http://localhost/api/v1/stripe/dashboard-link"));
    expect(res.status).toBe(500);
  });
});
