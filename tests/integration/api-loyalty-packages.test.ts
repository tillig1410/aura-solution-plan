import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

/**
 * Tests: GET+PUT /api/v1/loyalty + GET+POST /api/v1/packages + PATCH /api/v1/packages/:id
 */

const mockUser = { id: "user-abc" };
const mockMerchant = { id: "merchant-123" };
const SERVICE_ID = "a2b3c4d5-e6f7-8901-abcd-ef1234567890";
const PKG_ID = "b2c3d4e5-f6a7-8901-abcd-ef1234567890";

const mockLoyaltyProgram = {
  id: "loyalty-1",
  merchant_id: "merchant-123",
  points_per_visit: 10,
  points_per_euro: 1,
  silver_threshold: 100,
  gold_threshold: 500,
  is_active: true,
};

const mockPackage = {
  id: PKG_ID,
  merchant_id: "merchant-123",
  name: "Pack 5 coupes",
  service_id: SERVICE_ID,
  total_uses: 5,
  price_cents: 10000,
  validity_days: 365,
  is_active: true,
  created_at: "2026-01-01T00:00:00Z",
};

// ---- Mock Supabase ---------------------------------------------------------

function buildChain(resolvedData: unknown, resolvedError: null | { message: string; code?: string } = null) {
  const chain: Record<string, unknown> = {};
  for (const method of ["select", "eq", "order", "upsert", "insert", "update", "limit"]) {
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

const { createClient } = await import("@/lib/supabase/server");
const { GET: GET_LOYALTY, PUT: PUT_LOYALTY } = await import("@/app/api/v1/loyalty/route");
const { GET: GET_PACKAGES, POST: POST_PACKAGE } = await import("@/app/api/v1/packages/route");
const { PATCH: PATCH_PACKAGE } = await import("@/app/api/v1/packages/[id]/route");

// ---- Helpers ---------------------------------------------------------------

function jsonReq(url: string, method: string, body?: unknown) {
  return new NextRequest(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

const routeCtx = (id: string) => ({ params: Promise.resolve({ id }) });

function makeSb(options: { loyalty?: unknown; packages?: unknown[]; service?: unknown } = {}) {
  return {
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: mockUser }, error: null }) },
    from: vi.fn((table: string) => {
      if (table === "merchants") return buildChain(mockMerchant);
      if (table === "loyalty_programs") return buildChain(options.loyalty !== undefined ? options.loyalty : mockLoyaltyProgram);
      if (table === "packages") return buildChain(options.packages !== undefined ? options.packages : [mockPackage]);
      if (table === "services") return buildChain(options.service !== undefined ? options.service : { id: SERVICE_ID });
      return buildChain([]);
    }),
  };
}

// ---- GET /api/v1/loyalty ---------------------------------------------------

describe("GET /api/v1/loyalty — auth", () => {
  it("retourne 401 si non authentifié", async () => {
    vi.mocked(createClient).mockResolvedValueOnce({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }) },
      from: vi.fn(),
    } as unknown as Awaited<ReturnType<typeof createClient>>);

    const res = await GET_LOYALTY(new NextRequest("http://localhost/api/v1/loyalty"));
    expect(res.status).toBe(401);
  });
});

describe("GET /api/v1/loyalty — nominal", () => {
  it("retourne 200 avec le programme de fidélité", async () => {
    vi.mocked(createClient).mockResolvedValue(
      makeSb() as unknown as Awaited<ReturnType<typeof createClient>>,
    );

    const res = await GET_LOYALTY(new NextRequest("http://localhost/api/v1/loyalty"));
    expect(res.status).toBe(200);
    const body = await res.json() as { data: { is_active: boolean } };
    expect(body.data).toBeDefined();
  });

  it("retourne data: null si pas de programme configuré", async () => {
    vi.mocked(createClient).mockResolvedValue(
      makeSb({ loyalty: null }) as unknown as Awaited<ReturnType<typeof createClient>>,
    );

    const res = await GET_LOYALTY(new NextRequest("http://localhost/api/v1/loyalty"));
    expect(res.status).toBe(200);
    const body = await res.json() as { data: null };
    expect(body.data).toBeNull();
  });
});

// ---- PUT /api/v1/loyalty ---------------------------------------------------

describe("PUT /api/v1/loyalty — validation", () => {
  beforeEach(() => {
    vi.mocked(createClient).mockResolvedValue(
      makeSb() as unknown as Awaited<ReturnType<typeof createClient>>,
    );
  });

  it("retourne 400 si points_per_visit négatif", async () => {
    const res = await PUT_LOYALTY(jsonReq("http://localhost/api/v1/loyalty", "PUT", { points_per_visit: -1 }));
    expect(res.status).toBe(400);
  });

  it("retourne 400 si JSON invalide", async () => {
    const req = new NextRequest("http://localhost/api/v1/loyalty", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: "not-json",
    });
    const res = await PUT_LOYALTY(req);
    expect(res.status).toBe(400);
  });
});

describe("PUT /api/v1/loyalty — nominal", () => {
  it("retourne 200 avec le programme mis à jour", async () => {
    const updated = { ...mockLoyaltyProgram, points_per_visit: 20 };
    const sb = {
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: mockUser }, error: null }) },
      from: vi.fn((table: string) => {
        if (table === "merchants") return buildChain(mockMerchant);
        if (table === "loyalty_programs") return buildChain(updated);
        return buildChain([]);
      }),
    };
    vi.mocked(createClient).mockResolvedValue(sb as unknown as Awaited<ReturnType<typeof createClient>>);

    const res = await PUT_LOYALTY(jsonReq("http://localhost/api/v1/loyalty", "PUT", { points_per_visit: 20 }));
    expect(res.status).toBe(200);
  });
});

// ---- GET /api/v1/packages --------------------------------------------------

describe("GET /api/v1/packages — auth", () => {
  it("retourne 401 si non authentifié", async () => {
    vi.mocked(createClient).mockResolvedValueOnce({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }) },
      from: vi.fn(),
    } as unknown as Awaited<ReturnType<typeof createClient>>);

    const res = await GET_PACKAGES(new NextRequest("http://localhost/api/v1/packages"));
    expect(res.status).toBe(401);
  });
});

describe("GET /api/v1/packages — nominal", () => {
  it("retourne 200 avec la liste des forfaits", async () => {
    vi.mocked(createClient).mockResolvedValue(
      makeSb() as unknown as Awaited<ReturnType<typeof createClient>>,
    );

    const res = await GET_PACKAGES(new NextRequest("http://localhost/api/v1/packages"));
    expect(res.status).toBe(200);
    const body = await res.json() as { data: unknown[] };
    expect(Array.isArray(body.data)).toBe(true);
  });
});

// ---- POST /api/v1/packages -------------------------------------------------

describe("POST /api/v1/packages — validation", () => {
  beforeEach(() => {
    vi.mocked(createClient).mockResolvedValue(
      makeSb() as unknown as Awaited<ReturnType<typeof createClient>>,
    );
  });

  it("retourne 400 si name trop court", async () => {
    const res = await POST_PACKAGE(jsonReq("http://localhost/api/v1/packages", "POST", {
      name: "A",
      service_id: SERVICE_ID,
      total_uses: 5,
      price_cents: 10000,
    }));
    expect(res.status).toBe(400);
  });

  it("retourne 400 si service_id non-UUID", async () => {
    const res = await POST_PACKAGE(jsonReq("http://localhost/api/v1/packages", "POST", {
      name: "Pack 5",
      service_id: "not-uuid",
      total_uses: 5,
      price_cents: 10000,
    }));
    expect(res.status).toBe(400);
  });

  it("retourne 400 si total_uses < 1", async () => {
    const res = await POST_PACKAGE(jsonReq("http://localhost/api/v1/packages", "POST", {
      name: "Pack 5",
      service_id: SERVICE_ID,
      total_uses: 0,
      price_cents: 10000,
    }));
    expect(res.status).toBe(400);
  });

  it("retourne 400 si JSON invalide", async () => {
    const req = new NextRequest("http://localhost/api/v1/packages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "not-json",
    });
    const res = await POST_PACKAGE(req);
    expect(res.status).toBe(400);
  });

  it("retourne 404 si le service n'appartient pas au merchant", async () => {
    vi.mocked(createClient).mockResolvedValue(
      makeSb({ service: null }) as unknown as Awaited<ReturnType<typeof createClient>>,
    );

    const res = await POST_PACKAGE(jsonReq("http://localhost/api/v1/packages", "POST", {
      name: "Pack 5",
      service_id: SERVICE_ID,
      total_uses: 5,
      price_cents: 10000,
    }));
    expect(res.status).toBe(404);
  });
});

describe("POST /api/v1/packages — nominal", () => {
  it("retourne 201 avec le forfait créé", async () => {
    const sb = {
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: mockUser }, error: null }) },
      from: vi.fn((table: string) => {
        if (table === "merchants") return buildChain(mockMerchant);
        if (table === "services") return buildChain({ id: SERVICE_ID });
        if (table === "packages") return buildChain(mockPackage);
        return buildChain([]);
      }),
    };
    vi.mocked(createClient).mockResolvedValue(sb as unknown as Awaited<ReturnType<typeof createClient>>);

    const res = await POST_PACKAGE(jsonReq("http://localhost/api/v1/packages", "POST", {
      name: "Pack 5 coupes",
      service_id: SERVICE_ID,
      total_uses: 5,
      price_cents: 10000,
    }));
    expect(res.status).toBe(201);
    const body = await res.json() as { data: { name: string } };
    expect(body.data.name).toBe("Pack 5 coupes");
  });
});

// ---- PATCH /api/v1/packages/:id --------------------------------------------

describe("PATCH /api/v1/packages/:id — auth", () => {
  it("retourne 401 si non authentifié", async () => {
    vi.mocked(createClient).mockResolvedValueOnce({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }) },
      from: vi.fn(),
    } as unknown as Awaited<ReturnType<typeof createClient>>);

    const res = await PATCH_PACKAGE(
      jsonReq(`http://localhost/api/v1/packages/${PKG_ID}`, "PATCH", { is_active: false }),
      routeCtx(PKG_ID),
    );
    expect(res.status).toBe(401);
  });
});

describe("PATCH /api/v1/packages/:id — validation", () => {
  beforeEach(() => {
    vi.mocked(createClient).mockResolvedValue(
      makeSb({ packages: [mockPackage] }) as unknown as Awaited<ReturnType<typeof createClient>>,
    );
  });

  it("retourne 400 si is_active manquant", async () => {
    const res = await PATCH_PACKAGE(
      jsonReq(`http://localhost/api/v1/packages/${PKG_ID}`, "PATCH", {}),
      routeCtx(PKG_ID),
    );
    expect(res.status).toBe(400);
  });

  it("retourne 400 si JSON invalide", async () => {
    const req = new NextRequest(`http://localhost/api/v1/packages/${PKG_ID}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: "not-json",
    });
    const res = await PATCH_PACKAGE(req, routeCtx(PKG_ID));
    expect(res.status).toBe(400);
  });
});

describe("PATCH /api/v1/packages/:id — nominal", () => {
  it("retourne 200 avec le forfait désactivé", async () => {
    const deactivated = { ...mockPackage, is_active: false };
    const sb = {
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: mockUser }, error: null }) },
      from: vi.fn((table: string) => {
        if (table === "merchants") return buildChain(mockMerchant);
        if (table === "packages") return buildChain(deactivated);
        return buildChain([]);
      }),
    };
    vi.mocked(createClient).mockResolvedValue(sb as unknown as Awaited<ReturnType<typeof createClient>>);

    const res = await PATCH_PACKAGE(
      jsonReq(`http://localhost/api/v1/packages/${PKG_ID}`, "PATCH", { is_active: false }),
      routeCtx(PKG_ID),
    );
    expect(res.status).toBe(200);
    const body = await res.json() as { data: { is_active: boolean } };
    expect(body.data.is_active).toBe(false);
  });

  it("retourne 404 si package PGRST116", async () => {
    const sb = {
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: mockUser }, error: null }) },
      from: vi.fn((table: string) => {
        if (table === "merchants") return buildChain(mockMerchant);
        if (table === "packages") return buildChain(null, { message: "Row not found", code: "PGRST116" });
        return buildChain([]);
      }),
    };
    vi.mocked(createClient).mockResolvedValue(sb as unknown as Awaited<ReturnType<typeof createClient>>);

    const res = await PATCH_PACKAGE(
      jsonReq(`http://localhost/api/v1/packages/${PKG_ID}`, "PATCH", { is_active: false }),
      routeCtx(PKG_ID),
    );
    expect(res.status).toBe(404);
  });
});
