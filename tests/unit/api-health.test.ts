import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

/**
 * Tests: GET /api/v1/health
 * Le endpoint ne nécessite pas d'auth — teste uniquement la logique
 * d'agrégation du statut en fonction des services disponibles.
 */

vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn() },
}));

const { GET } = await import("@/app/api/v1/health/route");

// ---- Helpers ---------------------------------------------------------------

function mockFetch(responses: Array<{ ok: boolean; status?: number } | "error">) {
  let callIndex = 0;
  return vi.fn().mockImplementation(() => {
    const response = responses[callIndex % responses.length];
    callIndex++;
    if (response === "error") {
      return Promise.reject(new Error("Connection refused"));
    }
    return Promise.resolve({
      ok: response.ok,
      status: response.status ?? (response.ok ? 200 : 503),
    });
  });
}

// ---- Tests -----------------------------------------------------------------

describe("GET /api/v1/health — statut global", () => {
  const originalFetch = global.fetch;
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = {
      ...originalEnv,
      NEXT_PUBLIC_SUPABASE_URL: "https://test.supabase.co",
      REDIS_URL: "redis://localhost:6379",
      N8N_URL: "https://n8n.test.fr",
    };
  });

  afterEach(() => {
    global.fetch = originalFetch;
    process.env = originalEnv;
  });

  it("retourne 200 avec status = healthy si tous les services répondent", async () => {
    global.fetch = mockFetch([{ ok: true }, { ok: true }, { ok: true }]);

    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json() as { status: string; services: Record<string, { status: string }> };
    expect(body.status).toBe("healthy");
    expect(body.services.supabase.status).toBe("ok");
    expect(body.services.n8n.status).toBe("ok");
  });

  it("retourne 207 avec status = degraded si un service externe est en erreur", async () => {
    // Redis est toujours ok (hardcodé) — seuls Supabase et n8n font des fetch
    global.fetch = mockFetch([{ ok: true }, "error"]); // supabase ok, n8n error

    const res = await GET();
    expect(res.status).toBe(207);
    const body = await res.json() as { status: string };
    expect(body.status).toBe("degraded");
  });

  it("retourne 207 (degraded) même si Supabase et n8n sont tous les deux en erreur (Redis reste ok)", async () => {
    // Redis est toujours ok (hardcodé) → okCount >= 1 → jamais unhealthy
    global.fetch = mockFetch(["error", "error"]); // supabase error, n8n error

    const res = await GET();
    expect(res.status).toBe(207);
    const body = await res.json() as { status: string };
    expect(body.status).toBe("degraded");
  });

  it("la réponse contient timestamp et services", async () => {
    global.fetch = mockFetch([{ ok: true }, { ok: true }, { ok: true }]);

    const res = await GET();
    const body = await res.json() as { timestamp: string; services: { supabase: unknown; redis: unknown; n8n: unknown } };
    expect(typeof body.timestamp).toBe("string");
    expect(body.services).toBeDefined();
    expect(body.services.supabase).toBeDefined();
    expect(body.services.redis).toBeDefined();
    expect(body.services.n8n).toBeDefined();
  });

  it("chaque service contient status et latencyMs", async () => {
    global.fetch = mockFetch([{ ok: true }, { ok: true }, { ok: true }]);

    const res = await GET();
    const body = await res.json() as { services: { supabase: { status: string; latencyMs: number } } };
    expect(typeof body.services.supabase.status).toBe("string");
    expect(typeof body.services.supabase.latencyMs).toBe("number");
  });

  it("retourne 207 degraded si Supabase répond HTTP 503", async () => {
    global.fetch = mockFetch([{ ok: false, status: 503 }, { ok: true }]);

    const res = await GET();
    const body = await res.json() as { status: string; services: { supabase: { status: string } } };
    expect(body.services.supabase.status).toBe("error");
    expect(body.status).toBe("degraded");
    expect(res.status).toBe(207);
  });
});
