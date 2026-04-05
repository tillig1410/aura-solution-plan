import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

/**
 * Tests: GET+POST /api/v1/services + PATCH+DELETE /api/v1/services/:id
 */

const mockUser = { id: "user-abc" };
const mockMerchant = { id: "merchant-123" };
const SERVICE_ID = "s1b2c3d4-e5f6-7890-abcd-ef1234567890";

const mockService = {
  id: SERVICE_ID,
  merchant_id: "merchant-123",
  name: "Coupe homme",
  duration_minutes: 30,
  price_cents: 2500,
  description: null,
  is_active: true,
  sort_order: 0,
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
};

// ---- Mock Supabase ---------------------------------------------------------

function buildChain(resolvedData: unknown, resolvedError: null | { message: string; code?: string } = null) {
  const chain: Record<string, unknown> = {};
  for (const method of ["select", "eq", "order", "limit", "update", "insert", "range"]) {
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
  securityLog: { crossTenantBlocked: vi.fn() },
}));

const { createClient } = await import("@/lib/supabase/server");
const { GET, POST } = await import("@/app/api/v1/services/route");
const { PATCH, DELETE } = await import("@/app/api/v1/services/[id]/route");

// ---- Helpers ---------------------------------------------------------------

function getReq(params: Record<string, string> = {}) {
  const url = new URL("http://localhost/api/v1/services");
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  return new NextRequest(url.toString());
}

function postReq(body: unknown) {
  return new NextRequest("http://localhost/api/v1/services", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function patchReq(id: string, body: unknown) {
  return new NextRequest(`http://localhost/api/v1/services/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function deleteReq(id: string) {
  return new NextRequest(`http://localhost/api/v1/services/${id}`, { method: "DELETE" });
}

const routeCtx = (id: string) => ({ params: Promise.resolve({ id }) });

const mockServiceWithRelations = {
  ...mockService,
  practitioner_services: [{ practitioner_id: "p1" }],
};

function makeSb(services: unknown[] = [mockServiceWithRelations]) {
  return {
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: mockUser }, error: null }) },
    from: vi.fn((table: string) => {
      if (table === "merchants") return buildChain(mockMerchant);
      if (table === "services") return buildChain(services);
      return buildChain([]);
    }),
  };
}

// ---- GET /api/v1/services --------------------------------------------------

describe("GET /api/v1/services — auth", () => {
  it("retourne 401 si non authentifié", async () => {
    vi.mocked(createClient).mockResolvedValueOnce({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }) },
      from: vi.fn(),
    } as unknown as Awaited<ReturnType<typeof createClient>>);

    const res = await GET(getReq());
    expect(res.status).toBe(401);
  });
});

describe("GET /api/v1/services — nominal", () => {
  beforeEach(() => {
    vi.mocked(createClient).mockResolvedValue(
      makeSb() as unknown as Awaited<ReturnType<typeof createClient>>,
    );
  });

  it("retourne 200 avec la liste des services", async () => {
    const res = await GET(getReq());
    expect(res.status).toBe(200);
    const body = await res.json() as { data: unknown[] };
    expect(Array.isArray(body.data)).toBe(true);
  });

  it("chaque service contient practitioner_ids", async () => {
    const res = await GET(getReq());
    const body = await res.json() as { data: Array<{ practitioner_ids: string[] }> };
    expect(body.data[0].practitioner_ids).toEqual(["p1"]);
  });
});

// ---- POST /api/v1/services -------------------------------------------------

describe("POST /api/v1/services — validation", () => {
  beforeEach(() => {
    vi.mocked(createClient).mockResolvedValue(
      makeSb() as unknown as Awaited<ReturnType<typeof createClient>>,
    );
  });

  it("retourne 400 si name trop court", async () => {
    const res = await POST(postReq({ name: "A", duration_minutes: 30, price_cents: 1000 }));
    expect(res.status).toBe(400);
  });

  it("retourne 400 si duration_minutes < 5", async () => {
    const res = await POST(postReq({ name: "Coupe", duration_minutes: 3, price_cents: 1000 }));
    expect(res.status).toBe(400);
  });

  it("retourne 400 si price_cents négatif", async () => {
    const res = await POST(postReq({ name: "Coupe", duration_minutes: 30, price_cents: -1 }));
    expect(res.status).toBe(400);
  });

  it("retourne 400 si JSON invalide", async () => {
    const req = new NextRequest("http://localhost/api/v1/services", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "not-json",
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });
});

describe("POST /api/v1/services — nominal", () => {
  it("retourne 201 avec le service créé", async () => {
    const sb = {
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: mockUser }, error: null }) },
      from: vi.fn((table: string) => {
        if (table === "merchants") return buildChain(mockMerchant);
        if (table === "services") return buildChain(mockService);
        return buildChain([]);
      }),
    };
    vi.mocked(createClient).mockResolvedValue(sb as unknown as Awaited<ReturnType<typeof createClient>>);

    const res = await POST(postReq({ name: "Coupe homme", duration_minutes: 30, price_cents: 2500 }));
    expect(res.status).toBe(201);
    const body = await res.json() as { name: string };
    expect(body.name).toBe("Coupe homme");
  });
});

// ---- PATCH /api/v1/services/:id --------------------------------------------

describe("PATCH /api/v1/services/:id — auth + sécurité", () => {
  it("retourne 401 si non authentifié", async () => {
    vi.mocked(createClient).mockResolvedValueOnce({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }) },
      from: vi.fn(),
    } as unknown as Awaited<ReturnType<typeof createClient>>);

    const res = await PATCH(patchReq(SERVICE_ID, { name: "Coupe" }), routeCtx(SERVICE_ID));
    expect(res.status).toBe(401);
  });

  it("retourne 404 si service appartient à un autre merchant", async () => {
    const sb = {
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: mockUser }, error: null }) },
      from: vi.fn((table: string) => {
        if (table === "merchants") return buildChain(mockMerchant);
        if (table === "services") {
          const chain = buildChain(null);
          chain["single"] = vi.fn().mockResolvedValue({ data: null, error: null });
          return chain;
        }
        return buildChain([]);
      }),
    };
    vi.mocked(createClient).mockResolvedValueOnce(sb as unknown as Awaited<ReturnType<typeof createClient>>);

    const res = await PATCH(patchReq(SERVICE_ID, { name: "Coupe" }), routeCtx(SERVICE_ID));
    expect(res.status).toBe(404);
  });
});

describe("PATCH /api/v1/services/:id — validation", () => {
  beforeEach(() => {
    const sb = {
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: mockUser }, error: null }) },
      from: vi.fn((table: string) => {
        if (table === "merchants") return buildChain(mockMerchant);
        if (table === "services") return buildChain(mockService);
        return buildChain([]);
      }),
    };
    vi.mocked(createClient).mockResolvedValue(sb as unknown as Awaited<ReturnType<typeof createClient>>);
  });

  it("retourne 400 si duration_minutes > 480", async () => {
    const res = await PATCH(patchReq(SERVICE_ID, { duration_minutes: 500 }), routeCtx(SERVICE_ID));
    expect(res.status).toBe(400);
  });

  it("retourne 400 si JSON invalide", async () => {
    const req = new NextRequest(`http://localhost/api/v1/services/${SERVICE_ID}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: "not-json",
    });
    const res = await PATCH(req, routeCtx(SERVICE_ID));
    expect(res.status).toBe(400);
  });
});

describe("PATCH /api/v1/services/:id — nominal", () => {
  it("retourne 200 avec le service mis à jour", async () => {
    const updated = { ...mockService, name: "Coupe femme" };
    const sb = {
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: mockUser }, error: null }) },
      from: vi.fn((table: string) => {
        if (table === "merchants") return buildChain(mockMerchant);
        if (table === "services") return buildChain(updated);
        return buildChain([]);
      }),
    };
    vi.mocked(createClient).mockResolvedValue(sb as unknown as Awaited<ReturnType<typeof createClient>>);

    const res = await PATCH(patchReq(SERVICE_ID, { name: "Coupe femme" }), routeCtx(SERVICE_ID));
    expect(res.status).toBe(200);
    const body = await res.json() as { name: string };
    expect(body.name).toBe("Coupe femme");
  });
});

// ---- DELETE /api/v1/services/:id — soft delete -----------------------------

describe("DELETE /api/v1/services/:id", () => {
  it("retourne 401 si non authentifié", async () => {
    vi.mocked(createClient).mockResolvedValueOnce({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }) },
      from: vi.fn(),
    } as unknown as Awaited<ReturnType<typeof createClient>>);

    const res = await DELETE(deleteReq(SERVICE_ID), routeCtx(SERVICE_ID));
    expect(res.status).toBe(401);
  });

  it("retourne 200 avec { deleted: true } en cas de succès", async () => {
    const sb = {
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: mockUser }, error: null }) },
      from: vi.fn((table: string) => {
        if (table === "merchants") return buildChain(mockMerchant);
        if (table === "services") return buildChain(mockService);
        return buildChain([]);
      }),
    };
    vi.mocked(createClient).mockResolvedValue(sb as unknown as Awaited<ReturnType<typeof createClient>>);

    const res = await DELETE(deleteReq(SERVICE_ID), routeCtx(SERVICE_ID));
    expect(res.status).toBe(200);
    const body = await res.json() as { deleted: boolean; id: string };
    expect(body.deleted).toBe(true);
    expect(body.id).toBe(SERVICE_ID);
  });
});
