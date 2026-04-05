import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

/**
 * Tests: GET /api/v1/stats?period=month
 * Route la plus complexe — teste auth, validation, structure de réponse, agrégation.
 */

const mockUser = { id: "user-abc" };
const mockMerchant = { id: "merchant-123" };

// ---- Mock Supabase ---------------------------------------------------------

function buildChain(resolvedData: unknown, resolvedError: null | { message: string } = null, count: number | null = null) {
  const chain: Record<string, unknown> = {};
  for (const method of ["select", "eq", "gte", "lte", "neq", "order", "limit", "not", "in"]) {
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
const { GET } = await import("@/app/api/v1/stats/route");

// ---- Helpers ---------------------------------------------------------------

function statsReq(params: Record<string, string> = {}) {
  const url = new URL("http://localhost/api/v1/stats");
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  return new NextRequest(url.toString());
}

function makeSb(bookings: unknown[] = [], tips: unknown[] = [], clients: unknown[] = []) {
  return {
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: mockUser }, error: null }) },
    from: vi.fn((table: string) => {
      if (table === "merchants") return buildChain(mockMerchant);
      if (table === "bookings") return buildChain(bookings);
      if (table === "tips") return buildChain(tips);
      if (table === "clients") return buildChain(clients, null, clients.length);
      return buildChain([]);
    }),
  };
}

// ---- Auth ------------------------------------------------------------------

describe("GET /api/v1/stats — auth", () => {
  it("retourne 401 si non authentifié", async () => {
    vi.mocked(createClient).mockResolvedValueOnce({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }) },
      from: vi.fn(),
    } as unknown as Awaited<ReturnType<typeof createClient>>);

    const res = await GET(statsReq());
    expect(res.status).toBe(401);
  });

  it("retourne 404 si merchant introuvable", async () => {
    vi.mocked(createClient).mockResolvedValueOnce({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: mockUser }, error: null }) },
      from: vi.fn(() => buildChain(null)),
    } as unknown as Awaited<ReturnType<typeof createClient>>);

    const res = await GET(statsReq());
    expect(res.status).toBe(404);
  });
});

// ---- Structure réponse -----------------------------------------------------

describe("GET /api/v1/stats — structure réponse", () => {
  beforeEach(() => {
    vi.mocked(createClient).mockResolvedValue(
      makeSb() as unknown as Awaited<ReturnType<typeof createClient>>,
    );
  });

  it("retourne 200 avec la bonne structure", async () => {
    const res = await GET(statsReq({ period: "month" }));
    expect(res.status).toBe(200);
    const body = await res.json() as Record<string, unknown>;
    expect(body.period).toBe("month");
    expect(body.from).toBeDefined();
    expect(body.to).toBeDefined();
    expect(body.summary).toBeDefined();
    expect(body.revenue_by_day).toBeDefined();
    expect(body.bookings_by_day).toBeDefined();
    expect(body.by_channel).toBeDefined();
    expect(body.practitioners).toBeDefined();
    expect(body.clients).toBeDefined();
    expect(body.booking_patterns).toBeDefined();
  });

  it("summary contient revenue, bookings, fill_rate, tips + deltas", async () => {
    const res = await GET(statsReq());
    const body = await res.json() as { summary: Record<string, unknown> };
    const s = body.summary;
    expect(typeof s.revenue_cents).toBe("number");
    expect(typeof s.revenue_delta_pct).toBe("number");
    expect(typeof s.bookings_count).toBe("number");
    expect(typeof s.bookings_delta_pct).toBe("number");
    expect(typeof s.fill_rate).toBe("number");
    expect(typeof s.tips_total_cents).toBe("number");
  });

  it("booking_patterns contient cancel_rate, noshow_rate, by_hour, by_day_of_week", async () => {
    const res = await GET(statsReq());
    const body = await res.json() as { booking_patterns: Record<string, unknown> };
    const bp = body.booking_patterns;
    expect(typeof bp.cancel_rate).toBe("number");
    expect(typeof bp.noshow_rate).toBe("number");
    expect(Array.isArray(bp.by_hour)).toBe(true);
    expect(Array.isArray(bp.by_day_of_week)).toBe(true);
  });

  it("accepte tous les periods valides", async () => {
    for (const period of ["today", "week", "month", "quarter", "year"]) {
      vi.mocked(createClient).mockResolvedValueOnce(
        makeSb() as unknown as Awaited<ReturnType<typeof createClient>>,
      );
      const res = await GET(statsReq({ period }));
      expect(res.status).toBe(200);
      const body = await res.json() as { period: string };
      expect(body.period).toBe(period);
    }
  });

  it("fallback sur month si period invalide", async () => {
    const res = await GET(statsReq({ period: "decade" }));
    expect(res.status).toBe(200);
    const body = await res.json() as { period: string };
    expect(body.period).toBe("month");
  });

  it("retourne des valeurs à 0 si aucune donnée", async () => {
    const res = await GET(statsReq());
    const body = await res.json() as {
      summary: { revenue_cents: number; bookings_count: number; tips_total_cents: number };
      clients: { new_count: number };
    };
    expect(body.summary.revenue_cents).toBe(0);
    expect(body.summary.bookings_count).toBe(0);
    expect(body.summary.tips_total_cents).toBe(0);
    expect(body.clients.new_count).toBe(0);
  });
});
