import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

/**
 * Tests: GET+POST /api/v1/practitioners + PATCH /api/v1/practitioners/:id
 */

const mockUser = { id: "user-abc" };
const mockMerchant = { id: "merchant-123" };
const PRAC_ID = "p1b2c3d4-e5f6-7890-abcd-ef1234567890";

const mockPractitioner = {
  id: PRAC_ID,
  merchant_id: "merchant-123",
  name: "Marie Dupont",
  color: "#4F46E5",
  specialties: ["coupe", "couleur"],
  email: "marie@salon.fr",
  is_active: true,
  sort_order: 0,
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
};

// ---- Mock Supabase ---------------------------------------------------------

function buildChain(resolvedData: unknown, resolvedError: null | { message: string; code?: string } = null) {
  const chain: Record<string, unknown> = {};
  for (const method of ["select", "eq", "order", "limit", "update", "insert"]) {
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
const { GET, POST } = await import("@/app/api/v1/practitioners/route");
const { PATCH } = await import("@/app/api/v1/practitioners/[id]/route");

// ---- Helpers ---------------------------------------------------------------

const mockPracWithRelations = {
  ...mockPractitioner,
  practitioner_services: [{ service_id: "svc-1" }],
  practitioner_availability: [],
};

function makeSb(practitioners: unknown[] = [mockPracWithRelations]) {
  return {
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: mockUser }, error: null }) },
    from: vi.fn((table: string) => {
      if (table === "merchants") return buildChain(mockMerchant);
      if (table === "practitioners") return buildChain(practitioners);
      return buildChain([]);
    }),
  };
}

function postReq(body: unknown) {
  return new NextRequest("http://localhost/api/v1/practitioners", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function patchReq(id: string, body: unknown) {
  return new NextRequest(`http://localhost/api/v1/practitioners/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

const routeCtx = (id: string) => ({ params: Promise.resolve({ id }) });

// ---- GET /api/v1/practitioners ---------------------------------------------

describe("GET /api/v1/practitioners — auth", () => {
  it("retourne 401 si non authentifié", async () => {
    vi.mocked(createClient).mockResolvedValueOnce({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }) },
      from: vi.fn(),
    } as unknown as Awaited<ReturnType<typeof createClient>>);

    const res = await GET(new NextRequest("http://localhost/api/v1/practitioners"));
    expect(res.status).toBe(401);
  });
});

describe("GET /api/v1/practitioners — nominal", () => {
  beforeEach(() => {
    vi.mocked(createClient).mockResolvedValue(
      makeSb() as unknown as Awaited<ReturnType<typeof createClient>>,
    );
  });

  it("retourne 200 avec la liste des praticiens", async () => {
    const res = await GET(new NextRequest("http://localhost/api/v1/practitioners"));
    expect(res.status).toBe(200);
    const body = await res.json() as { data: unknown[] };
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.data).toHaveLength(1);
  });

  it("chaque praticien contient service_ids et availability", async () => {
    const res = await GET(new NextRequest("http://localhost/api/v1/practitioners"));
    const body = await res.json() as { data: Array<{ service_ids: string[]; availability: unknown[] }> };
    expect(body.data[0].service_ids).toEqual(["svc-1"]);
    expect(Array.isArray(body.data[0].availability)).toBe(true);
  });
});

// ---- POST /api/v1/practitioners --------------------------------------------

describe("POST /api/v1/practitioners — validation", () => {
  beforeEach(() => {
    vi.mocked(createClient).mockResolvedValue(
      makeSb() as unknown as Awaited<ReturnType<typeof createClient>>,
    );
  });

  it("retourne 400 si name trop court", async () => {
    const res = await POST(postReq({ name: "A", color: "#4F46E5" }));
    expect(res.status).toBe(400);
  });

  it("retourne 400 si couleur format invalide", async () => {
    const res = await POST(postReq({ name: "Marie", color: "blue" }));
    expect(res.status).toBe(400);
  });

  it("retourne 400 si couleur sans #", async () => {
    const res = await POST(postReq({ name: "Marie", color: "4F46E5" }));
    expect(res.status).toBe(400);
  });

  it("retourne 400 si email invalide", async () => {
    const res = await POST(postReq({ name: "Marie Dupont", color: "#4F46E5", email: "not-email" }));
    expect(res.status).toBe(400);
  });

  it("retourne 400 si JSON invalide", async () => {
    const req = new NextRequest("http://localhost/api/v1/practitioners", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "not-json",
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });
});

describe("POST /api/v1/practitioners — nominal", () => {
  it("retourne 201 avec le praticien créé", async () => {
    const sb = {
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: mockUser }, error: null }) },
      from: vi.fn((table: string) => {
        if (table === "merchants") return buildChain(mockMerchant);
        if (table === "practitioners") return buildChain(mockPractitioner);
        return buildChain([]);
      }),
    };
    vi.mocked(createClient).mockResolvedValue(sb as unknown as Awaited<ReturnType<typeof createClient>>);

    const res = await POST(postReq({ name: "Marie Dupont", color: "#4F46E5" }));
    expect(res.status).toBe(201);
    const body = await res.json() as { name: string; color: string };
    expect(body.name).toBe("Marie Dupont");
    expect(body.color).toBe("#4F46E5");
  });

  it("accepte une couleur hexadécimale minuscule", async () => {
    const sb = {
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: mockUser }, error: null }) },
      from: vi.fn((table: string) => {
        if (table === "merchants") return buildChain(mockMerchant);
        if (table === "practitioners") return buildChain({ ...mockPractitioner, color: "#abcdef" });
        return buildChain([]);
      }),
    };
    vi.mocked(createClient).mockResolvedValue(sb as unknown as Awaited<ReturnType<typeof createClient>>);

    const res = await POST(postReq({ name: "Pierre Martin", color: "#abcdef" }));
    expect(res.status).toBe(201);
  });
});

// ---- PATCH /api/v1/practitioners/:id ---------------------------------------

describe("PATCH /api/v1/practitioners/:id — auth + sécurité", () => {
  it("retourne 401 si non authentifié", async () => {
    vi.mocked(createClient).mockResolvedValueOnce({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }) },
      from: vi.fn(),
    } as unknown as Awaited<ReturnType<typeof createClient>>);

    const res = await PATCH(patchReq(PRAC_ID, { name: "Test" }), routeCtx(PRAC_ID));
    expect(res.status).toBe(401);
  });

  it("retourne 404 si praticien n'appartient pas au merchant", async () => {
    const sb = {
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: mockUser }, error: null }) },
      from: vi.fn((table: string) => {
        if (table === "merchants") return buildChain(mockMerchant);
        if (table === "practitioners") {
          const chain = buildChain(null);
          chain["single"] = vi.fn().mockResolvedValue({ data: null, error: null });
          return chain;
        }
        return buildChain([]);
      }),
    };
    vi.mocked(createClient).mockResolvedValueOnce(sb as unknown as Awaited<ReturnType<typeof createClient>>);

    const res = await PATCH(patchReq(PRAC_ID, { name: "Test" }), routeCtx(PRAC_ID));
    expect(res.status).toBe(404);
  });
});

describe("PATCH /api/v1/practitioners/:id — validation", () => {
  beforeEach(() => {
    const sb = {
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: mockUser }, error: null }) },
      from: vi.fn((table: string) => {
        if (table === "merchants") return buildChain(mockMerchant);
        if (table === "practitioners") return buildChain(mockPractitioner);
        return buildChain([]);
      }),
    };
    vi.mocked(createClient).mockResolvedValue(sb as unknown as Awaited<ReturnType<typeof createClient>>);
  });

  it("retourne 400 si couleur invalide", async () => {
    const res = await PATCH(patchReq(PRAC_ID, { color: "red" }), routeCtx(PRAC_ID));
    expect(res.status).toBe(400);
  });

  it("retourne 400 si JSON invalide", async () => {
    const req = new NextRequest(`http://localhost/api/v1/practitioners/${PRAC_ID}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: "not-json",
    });
    const res = await PATCH(req, routeCtx(PRAC_ID));
    expect(res.status).toBe(400);
  });
});

describe("PATCH /api/v1/practitioners/:id — nominal", () => {
  it("retourne 200 avec le praticien mis à jour", async () => {
    const updated = { ...mockPractitioner, color: "#FF0000" };
    const sb = {
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: mockUser }, error: null }) },
      from: vi.fn((table: string) => {
        if (table === "merchants") return buildChain(mockMerchant);
        if (table === "practitioners") return buildChain(updated);
        return buildChain([]);
      }),
    };
    vi.mocked(createClient).mockResolvedValue(sb as unknown as Awaited<ReturnType<typeof createClient>>);

    const res = await PATCH(patchReq(PRAC_ID, { color: "#FF0000" }), routeCtx(PRAC_ID));
    expect(res.status).toBe(200);
    const body = await res.json() as { color: string };
    expect(body.color).toBe("#FF0000");
  });
});
