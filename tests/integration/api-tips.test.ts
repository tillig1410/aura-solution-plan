import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

/**
 * Tests: GET /api/v1/tips + GET /api/v1/tips/summary
 */

const mockUser = { id: "user-abc" };
const mockMerchant = { id: "merchant-123" };
const PRAC_ID = "a1b2c3d4-e5f6-7890-abcd-ef1234567890";

const mockTip = {
  id: "tip-1",
  merchant_id: "merchant-123",
  practitioner_id: PRAC_ID,
  client_id: "client-1",
  amount_cents: 500,
  created_at: "2026-04-01T10:00:00Z",
  practitioner: { id: PRAC_ID, name: "Marie Dupont", color: "#4F46E5" },
  client: { id: "client-1", name: "Jean Petit", phone: "+33600000001" },
};

// ---- Mock Supabase ---------------------------------------------------------

function buildChain(resolvedData: unknown, resolvedError: null | { message: string } = null, count: number | null = null) {
  const chain: Record<string, unknown> = {};
  for (const method of ["select", "eq", "gte", "lte", "order", "limit", "range"]) {
    chain[method] = vi.fn().mockReturnValue(chain);
  }
  chain["single"] = vi.fn().mockResolvedValue({ data: resolvedData, error: resolvedError });
  chain["then"] = (onFulfilled: (v: { data: unknown; error: unknown; count: unknown }) => void) =>
    Promise.resolve({ data: resolvedData, error: resolvedError, count }).then(onFulfilled);
  return chain;
}

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn() },
}));

const { createClient } = await import("@/lib/supabase/server");
const { GET: GET_TIPS } = await import("@/app/api/v1/tips/route");
const { GET: GET_SUMMARY } = await import("@/app/api/v1/tips/summary/route");

// ---- Helpers ---------------------------------------------------------------

function tipsReq(params: Record<string, string> = {}) {
  const url = new URL("http://localhost/api/v1/tips");
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  return new NextRequest(url.toString());
}

function summaryReq(params: Record<string, string> = {}) {
  const url = new URL("http://localhost/api/v1/tips/summary");
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  return new NextRequest(url.toString());
}

function makeSb(tips: unknown[] = [mockTip]) {
  return {
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: mockUser }, error: null }) },
    from: vi.fn((table: string) => {
      if (table === "merchants") return buildChain(mockMerchant);
      if (table === "tips") return buildChain(tips, null, tips.length);
      if (table === "practitioners") return buildChain([{ id: PRAC_ID, name: "Marie Dupont", color: "#4F46E5" }]);
      return buildChain([]);
    }),
  };
}

// ---- GET /api/v1/tips — auth -----------------------------------------------

describe("GET /api/v1/tips — auth", () => {
  it("retourne 401 si non authentifié", async () => {
    vi.mocked(createClient).mockResolvedValueOnce({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }) },
      from: vi.fn(),
    } as unknown as Awaited<ReturnType<typeof createClient>>);

    const res = await GET_TIPS(tipsReq());
    expect(res.status).toBe(401);
  });
});

// ---- GET /api/v1/tips — validation -----------------------------------------

describe("GET /api/v1/tips — validation", () => {
  beforeEach(() => {
    vi.mocked(createClient).mockResolvedValue(
      makeSb() as unknown as Awaited<ReturnType<typeof createClient>>,
    );
  });

  it("retourne 400 si practitioner_id n'est pas un UUID", async () => {
    const res = await GET_TIPS(tipsReq({ practitioner_id: "not-uuid" }));
    expect(res.status).toBe(400);
  });

  it("retourne 400 si from n'est pas une date ISO", async () => {
    const res = await GET_TIPS(tipsReq({ from: "01/04/2026" }));
    expect(res.status).toBe(400);
  });

  it("retourne 400 si to n'est pas une date ISO", async () => {
    const res = await GET_TIPS(tipsReq({ to: "avril 2026" }));
    expect(res.status).toBe(400);
  });

  it("accepte un UUID valide en practitioner_id", async () => {
    const res = await GET_TIPS(tipsReq({ practitioner_id: PRAC_ID }));
    expect(res.status).toBe(200);
  });
});

// ---- GET /api/v1/tips — nominal --------------------------------------------

describe("GET /api/v1/tips — nominal", () => {
  it("retourne 200 avec liste, count, page, total_pages", async () => {
    vi.mocked(createClient).mockResolvedValue(
      makeSb([mockTip]) as unknown as Awaited<ReturnType<typeof createClient>>,
    );

    const res = await GET_TIPS(tipsReq());
    expect(res.status).toBe(200);
    const body = await res.json() as { data: unknown[]; count: number; page: number; total_pages: number };
    expect(Array.isArray(body.data)).toBe(true);
    expect(typeof body.count).toBe("number");
    expect(body.page).toBe(1);
    expect(typeof body.total_pages).toBe("number");
  });

  it("retourne liste vide si aucun pourboire", async () => {
    vi.mocked(createClient).mockResolvedValue(
      makeSb([]) as unknown as Awaited<ReturnType<typeof createClient>>,
    );

    const res = await GET_TIPS(tipsReq());
    expect(res.status).toBe(200);
    const body = await res.json() as { data: unknown[] };
    expect(body.data).toHaveLength(0);
  });
});

// ---- GET /api/v1/tips/summary — auth ----------------------------------------

describe("GET /api/v1/tips/summary — auth", () => {
  it("retourne 401 si non authentifié", async () => {
    vi.mocked(createClient).mockResolvedValueOnce({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }) },
      from: vi.fn(),
    } as unknown as Awaited<ReturnType<typeof createClient>>);

    const res = await GET_SUMMARY(summaryReq());
    expect(res.status).toBe(401);
  });
});

// ---- GET /api/v1/tips/summary — nominal ------------------------------------

describe("GET /api/v1/tips/summary — nominal", () => {
  it("retourne 200 avec grand_total_cents et by_practitioner", async () => {
    vi.mocked(createClient).mockResolvedValue(
      makeSb([{ practitioner_id: PRAC_ID, amount_cents: 500 }]) as unknown as Awaited<ReturnType<typeof createClient>>,
    );

    const res = await GET_SUMMARY(summaryReq());
    expect(res.status).toBe(200);
    const body = await res.json() as { grand_total_cents: number; by_practitioner: unknown[]; total_tips: number };
    expect(typeof body.grand_total_cents).toBe("number");
    expect(Array.isArray(body.by_practitioner)).toBe(true);
    expect(typeof body.total_tips).toBe("number");
  });

  it("grand_total_cents = 0 si aucun pourboire", async () => {
    vi.mocked(createClient).mockResolvedValue(
      makeSb([]) as unknown as Awaited<ReturnType<typeof createClient>>,
    );

    const res = await GET_SUMMARY(summaryReq());
    const body = await res.json() as { grand_total_cents: number; by_practitioner: unknown[] };
    expect(body.grand_total_cents).toBe(0);
    expect(body.by_practitioner).toHaveLength(0);
  });

  it("agrège correctement plusieurs pourboires pour le même praticien", async () => {
    vi.mocked(createClient).mockResolvedValue(
      makeSb([
        { practitioner_id: PRAC_ID, amount_cents: 300 },
        { practitioner_id: PRAC_ID, amount_cents: 200 },
      ]) as unknown as Awaited<ReturnType<typeof createClient>>,
    );

    const res = await GET_SUMMARY(summaryReq());
    const body = await res.json() as { grand_total_cents: number; by_practitioner: Array<{ total_cents: number; tip_count: number }> };
    expect(body.grand_total_cents).toBe(500);
    expect(body.by_practitioner[0].total_cents).toBe(500);
    expect(body.by_practitioner[0].tip_count).toBe(2);
  });
});
