import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

/**
 * Tests: GET+POST /api/v1/clients + GET+PATCH /api/v1/clients/:id
 */

const mockUser = { id: "user-abc" };
const mockMerchant = { id: "merchant-123" };
const CLIENT_ID = "c1b2c3d4-e5f6-7890-abcd-ef1234567890";

const mockClient = {
  id: CLIENT_ID,
  merchant_id: "merchant-123",
  name: "Jean Petit",
  phone: "+33600000001",
  email: "jean@example.com",
  notes: null,
  is_blocked: false,
  loyalty_points: 120,
  loyalty_tier: "silver",
  no_show_count: 0,
  preferred_practitioner_id: null,
  preferred_service_id: null,
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
};

// ---- Mock Supabase ---------------------------------------------------------

function buildChain(
  resolvedData: unknown,
  resolvedError: null | { message: string; code?: string } = null,
  count: number | null = null,
) {
  const chain: Record<string, unknown> = {};
  for (const method of ["select", "eq", "gte", "lte", "lt", "order", "not", "in", "limit", "update", "insert", "range", "or", "gt"]) {
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
  securityLog: { crossTenantBlocked: vi.fn() },
}));

const { createClient } = await import("@/lib/supabase/server");
const { GET: GET_LIST, POST } = await import("@/app/api/v1/clients/route");
const { GET: GET_ONE, PATCH } = await import("@/app/api/v1/clients/[id]/route");

// ---- Helpers ---------------------------------------------------------------

function listReq(params: Record<string, string> = {}) {
  const url = new URL("http://localhost/api/v1/clients");
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  return new NextRequest(url.toString());
}

function postReq(body: unknown) {
  return new NextRequest("http://localhost/api/v1/clients", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function patchReq(id: string, body: unknown) {
  return new NextRequest(`http://localhost/api/v1/clients/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

const routeCtx = (id: string) => ({ params: Promise.resolve({ id }) });

function makeListSb(clients: unknown[] = [mockClient]) {
  const merchantChain = buildChain(mockMerchant);
  const clientsChain = buildChain(clients, null, clients.length);
  const bookingsChain = buildChain([], null, 0);

  return {
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: mockUser }, error: null }) },
    from: vi.fn((table: string) => {
      if (table === "merchants") return merchantChain;
      if (table === "clients") return clientsChain;
      if (table === "bookings") return bookingsChain;
      return buildChain([]);
    }),
  };
}

// ---- GET /api/v1/clients ---------------------------------------------------

describe("GET /api/v1/clients — auth", () => {
  it("retourne 401 si non authentifié", async () => {
    vi.mocked(createClient).mockResolvedValueOnce({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }) },
      from: vi.fn(),
    } as unknown as Awaited<ReturnType<typeof createClient>>);

    const res = await GET_LIST(listReq());
    expect(res.status).toBe(401);
  });

  it("retourne 404 si merchant introuvable", async () => {
    vi.mocked(createClient).mockResolvedValueOnce({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: mockUser }, error: null }) },
      from: vi.fn(() => buildChain(null)),
    } as unknown as Awaited<ReturnType<typeof createClient>>);

    const res = await GET_LIST(listReq());
    expect(res.status).toBe(404);
  });
});

describe("GET /api/v1/clients — validation", () => {
  beforeEach(() => {
    vi.mocked(createClient).mockResolvedValue(
      makeListSb() as unknown as Awaited<ReturnType<typeof createClient>>,
    );
  });

  it("retourne 400 si filter invalide", async () => {
    const res = await GET_LIST(listReq({ filter: "vip" }));
    expect(res.status).toBe(400);
    const body = await res.json() as { error: string };
    expect(body.error).toBe("Invalid filter value");
  });

  it("accepte les filtres valides (loyal, new, inactive, all)", async () => {
    for (const filter of ["all", "loyal", "new", "inactive"]) {
      vi.mocked(createClient).mockResolvedValueOnce(
        makeListSb() as unknown as Awaited<ReturnType<typeof createClient>>,
      );
      const res = await GET_LIST(listReq({ filter }));
      expect(res.status).toBe(200);
    }
  });
});

describe("GET /api/v1/clients — nominal", () => {
  it("retourne 200 avec liste + pagination", async () => {
    vi.mocked(createClient).mockResolvedValue(
      makeListSb([mockClient]) as unknown as Awaited<ReturnType<typeof createClient>>,
    );

    const res = await GET_LIST(listReq());
    expect(res.status).toBe(200);
    const body = await res.json() as { data: unknown[]; count: number };
    expect(body.data).toBeDefined();
    expect(typeof body.count).toBe("number");
  });

  it("retourne data vide si aucun client", async () => {
    vi.mocked(createClient).mockResolvedValue(
      makeListSb([]) as unknown as Awaited<ReturnType<typeof createClient>>,
    );

    const res = await GET_LIST(listReq());
    expect(res.status).toBe(200);
    const body = await res.json() as { data: unknown[] };
    expect(body.data).toHaveLength(0);
  });
});

// ---- POST /api/v1/clients --------------------------------------------------

describe("POST /api/v1/clients — validation", () => {
  beforeEach(() => {
    vi.mocked(createClient).mockResolvedValue(
      makeListSb() as unknown as Awaited<ReturnType<typeof createClient>>,
    );
  });

  it("retourne 400 si name trop court", async () => {
    const res = await POST(postReq({ name: "A" }));
    expect(res.status).toBe(400);
  });

  it("retourne 400 si email invalide", async () => {
    const res = await POST(postReq({ name: "Jean Petit", email: "not-an-email" }));
    expect(res.status).toBe(400);
  });

  it("retourne 400 si JSON invalide", async () => {
    const req = new NextRequest("http://localhost/api/v1/clients", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "not-json",
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });
});

describe("POST /api/v1/clients — nominal", () => {
  it("retourne 201 avec le client créé", async () => {
    const insertChain = buildChain(mockClient);
    const sb = {
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: mockUser }, error: null }) },
      from: vi.fn((table: string) => {
        if (table === "merchants") return buildChain(mockMerchant);
        if (table === "clients") return insertChain;
        return buildChain([]);
      }),
    };
    vi.mocked(createClient).mockResolvedValue(sb as unknown as Awaited<ReturnType<typeof createClient>>);

    const res = await POST(postReq({ name: "Jean Petit", phone: "+33600000001" }));
    expect(res.status).toBe(201);
    const body = await res.json() as { id: string; name: string };
    expect(body.name).toBe("Jean Petit");
  });
});

// ---- GET /api/v1/clients/:id -----------------------------------------------

describe("GET /api/v1/clients/:id — auth + sécurité", () => {
  it("retourne 401 si non authentifié", async () => {
    vi.mocked(createClient).mockResolvedValueOnce({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }) },
      from: vi.fn(),
    } as unknown as Awaited<ReturnType<typeof createClient>>);

    const res = await GET_ONE(listReq(), routeCtx(CLIENT_ID));
    expect(res.status).toBe(401);
  });

  it("retourne 404 si client n'appartient pas au merchant", async () => {
    const sb = {
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: mockUser }, error: null }) },
      from: vi.fn((table: string) => {
        if (table === "merchants") return buildChain(mockMerchant);
        // client introuvable → PGRST116
        if (table === "clients") {
          const chain = buildChain(null, { message: "Row not found", code: "PGRST116" });
          return chain;
        }
        return buildChain([]);
      }),
    };
    vi.mocked(createClient).mockResolvedValueOnce(sb as unknown as Awaited<ReturnType<typeof createClient>>);

    const res = await GET_ONE(listReq(), routeCtx(CLIENT_ID));
    expect(res.status).toBe(404);
  });
});

describe("GET /api/v1/clients/:id — nominal", () => {
  it("retourne 200 avec client + recent_bookings + active_packages", async () => {
    const sb = {
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: mockUser }, error: null }) },
      from: vi.fn((table: string) => {
        if (table === "merchants") return buildChain(mockMerchant);
        if (table === "clients") return buildChain(mockClient);
        if (table === "bookings") return buildChain([]);
        if (table === "client_packages") return buildChain([]);
        return buildChain([]);
      }),
    };
    vi.mocked(createClient).mockResolvedValue(sb as unknown as Awaited<ReturnType<typeof createClient>>);

    const res = await GET_ONE(new NextRequest(`http://localhost/api/v1/clients/${CLIENT_ID}`), routeCtx(CLIENT_ID));
    expect(res.status).toBe(200);
    const body = await res.json() as { id: string; recent_bookings: unknown[]; active_packages: unknown[] };
    expect(body.id).toBe(CLIENT_ID);
    expect(Array.isArray(body.recent_bookings)).toBe(true);
    expect(Array.isArray(body.active_packages)).toBe(true);
  });
});

// ---- PATCH /api/v1/clients/:id ---------------------------------------------

describe("PATCH /api/v1/clients/:id — validation", () => {
  beforeEach(() => {
    const sb = {
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: mockUser }, error: null }) },
      from: vi.fn((table: string) => {
        if (table === "merchants") return buildChain(mockMerchant);
        if (table === "clients") return buildChain(mockClient);
        return buildChain([]);
      }),
    };
    vi.mocked(createClient).mockResolvedValue(sb as unknown as Awaited<ReturnType<typeof createClient>>);
  });

  it("retourne 400 si name trop court", async () => {
    const res = await PATCH(patchReq(CLIENT_ID, { name: "X" }), routeCtx(CLIENT_ID));
    expect(res.status).toBe(400);
  });

  it("retourne 400 si JSON invalide", async () => {
    const req = new NextRequest(`http://localhost/api/v1/clients/${CLIENT_ID}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: "not-json",
    });
    const res = await PATCH(req, routeCtx(CLIENT_ID));
    expect(res.status).toBe(400);
  });
});

describe("PATCH /api/v1/clients/:id — nominal", () => {
  it("retourne 200 avec le client mis à jour", async () => {
    const updated = { ...mockClient, name: "Jean Modifié" };
    const sb = {
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: mockUser }, error: null }) },
      from: vi.fn((table: string) => {
        if (table === "merchants") return buildChain(mockMerchant);
        if (table === "clients") return buildChain(updated);
        return buildChain([]);
      }),
    };
    vi.mocked(createClient).mockResolvedValue(sb as unknown as Awaited<ReturnType<typeof createClient>>);

    const res = await PATCH(patchReq(CLIENT_ID, { name: "Jean Modifié" }), routeCtx(CLIENT_ID));
    expect(res.status).toBe(200);
    const body = await res.json() as { name: string };
    expect(body.name).toBe("Jean Modifié");
  });

  it("retourne 404 si client appartient à un autre merchant", async () => {
    const sb = {
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: mockUser }, error: null }) },
      from: vi.fn((table: string) => {
        if (table === "merchants") return buildChain(mockMerchant);
        if (table === "clients") {
          const chain = buildChain(null);
          chain["single"] = vi.fn().mockResolvedValue({ data: null, error: null });
          return chain;
        }
        return buildChain([]);
      }),
    };
    vi.mocked(createClient).mockResolvedValueOnce(sb as unknown as Awaited<ReturnType<typeof createClient>>);

    const res = await PATCH(patchReq(CLIENT_ID, { name: "Hacker" }), routeCtx(CLIENT_ID));
    expect(res.status).toBe(404);
  });
});
