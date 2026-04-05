import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

/**
 * Tests: GET /api/v1/booking/:slug (public) + POST /api/v1/booking/:slug/reserve (public)
 * Routes publiques sans auth — surface d'attaque critique.
 * Utilisent createAdminClient (bypass RLS).
 */

const VALID_UUID = "a1b2c3d4-e5f6-7890-abcd-ef1234567890";

const mockMerchant = {
  id: "merchant-123",
  name: "Salon Test",
  slug: "salon-test",
  address: "1 rue du Test",
  phone: "+33100000000",
  opening_hours: {},
  ai_name: "AurA",
};

const mockService = {
  id: VALID_UUID,
  name: "Coupe homme",
  description: null,
  duration_minutes: 30,
  price_cents: 2500,
};

const mockPractitioner = {
  id: VALID_UUID,
  name: "Marie Dupont",
  color: "#4F46E5",
  specialties: ["coupe"],
  practitioner_services: [{ service_id: VALID_UUID }],
};

const mockAvailability = [
  { practitioner_id: VALID_UUID, day_of_week: 1, start_time: "09:00", end_time: "18:00", is_available: true, exception_date: null },
];

// ---- Mock Supabase ---------------------------------------------------------

function buildChain(resolvedData: unknown, resolvedError: null | { message: string; code?: string } = null) {
  const chain: Record<string, unknown> = {};
  for (const method of ["select", "eq", "neq", "gt", "lt", "gte", "lte", "order", "limit", "insert", "update"]) {
    chain[method] = vi.fn().mockReturnValue(chain);
  }
  chain["single"] = vi.fn().mockResolvedValue({ data: resolvedData, error: resolvedError });
  chain["then"] = (onFulfilled: (v: { data: unknown; error: unknown }) => void) =>
    Promise.resolve({ data: resolvedData, error: resolvedError }).then(onFulfilled);
  return chain;
}

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
  createAdminClient: vi.fn(),
}));
vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn() },
  webhookLog: { received: vi.fn(), forwarded: vi.fn(), invalidPayload: vi.fn() },
  securityLog: { crossTenantBlocked: vi.fn(), signatureRejected: vi.fn(), misconfiguration: vi.fn() },
}));

const { createAdminClient } = await import("@/lib/supabase/server");
const { GET } = await import("@/app/api/v1/booking/[slug]/route");
const { POST } = await import("@/app/api/v1/booking/[slug]/reserve/route");

const routeCtx = (slug: string) => ({ params: Promise.resolve({ slug }) });

// ---- GET /api/v1/booking/:slug — salon public info -------------------------

function makeGetSb() {
  return {
    from: vi.fn((table: string) => {
      if (table === "merchants") return buildChain(mockMerchant);
      if (table === "services") return buildChain([mockService]);
      if (table === "practitioners") return buildChain([mockPractitioner]);
      if (table === "practitioner_availability") return buildChain(mockAvailability);
      return buildChain([]);
    }),
  };
}

describe("GET /api/v1/booking/:slug — validation slug", () => {
  it("retourne 404 si slug contient des caractères invalides", async () => {
    const res = await GET(new NextRequest("http://localhost/api/v1/booking/INVALID_SLUG!"), routeCtx("INVALID_SLUG!"));
    expect(res.status).toBe(404);
  });

  it("retourne 404 si slug trop long (>100 chars)", async () => {
    const longSlug = "a".repeat(101);
    const res = await GET(new NextRequest(`http://localhost/api/v1/booking/${longSlug}`), routeCtx(longSlug));
    expect(res.status).toBe(404);
  });

  it("retourne 404 si slug inconnu", async () => {
    vi.mocked(createAdminClient).mockReturnValue({
      from: vi.fn(() => buildChain(null)),
    } as unknown as ReturnType<typeof createAdminClient>);

    const res = await GET(new NextRequest("http://localhost/api/v1/booking/unknown"), routeCtx("unknown"));
    expect(res.status).toBe(404);
    const body = await res.json() as { error: string };
    expect(body.error).toBe("Salon not found");
  });
});

describe("GET /api/v1/booking/:slug — nominal", () => {
  beforeEach(() => {
    vi.mocked(createAdminClient).mockReturnValue(
      makeGetSb() as unknown as ReturnType<typeof createAdminClient>,
    );
  });

  it("retourne 200 avec les infos du salon", async () => {
    const res = await GET(new NextRequest("http://localhost/api/v1/booking/salon-test"), routeCtx("salon-test"));
    expect(res.status).toBe(200);
    const body = await res.json() as { data: { name: string; services: unknown[]; practitioners: unknown[] } };
    expect(body.data.name).toBe("Salon Test");
    expect(Array.isArray(body.data.services)).toBe(true);
    expect(Array.isArray(body.data.practitioners)).toBe(true);
  });

  it("inclut les service_ids et availability de chaque praticien", async () => {
    const res = await GET(new NextRequest("http://localhost/api/v1/booking/salon-test"), routeCtx("salon-test"));
    const body = await res.json() as { data: { practitioners: Array<{ service_ids: string[]; availability: unknown[] }> } };
    expect(body.data.practitioners[0].service_ids).toEqual([VALID_UUID]);
    expect(Array.isArray(body.data.practitioners[0].availability)).toBe(true);
  });

  it("ne retourne pas le merchant_id (pas d'info interne exposée)", async () => {
    const res = await GET(new NextRequest("http://localhost/api/v1/booking/salon-test"), routeCtx("salon-test"));
    const body = await res.json() as { data: Record<string, unknown> };
    expect(body.data["id"]).toBeUndefined();
    expect(body.data["merchant_id"]).toBeUndefined();
  });
});

// ---- POST /api/v1/booking/:slug/reserve — réservation publique -------------

function makeReserveSb(options: {
  merchant?: unknown;
  practitioner?: unknown;
  service?: unknown;
  existingClient?: unknown;
  newClient?: unknown;
  conflicting?: unknown[];
  booking?: unknown;
  bookingError?: { message: string; code?: string } | null;
} = {}) {
  let bookingsCallCount = 0;
  let clientsCallCount = 0;
  return {
    from: vi.fn((table: string) => {
      if (table === "merchants") return buildChain(options.merchant !== undefined ? options.merchant : { id: "merchant-123" });
      if (table === "practitioners") return buildChain(options.practitioner !== undefined ? options.practitioner : { id: VALID_UUID });
      if (table === "services") return buildChain(options.service !== undefined ? options.service : { id: VALID_UUID, duration_minutes: 30 });
      if (table === "clients") {
        clientsCallCount++;
        if (clientsCallCount === 1) {
          // existingClient lookup
          return buildChain(options.existingClient !== undefined ? options.existingClient : null);
        }
        // new client insert
        return buildChain(options.newClient !== undefined ? options.newClient : { id: "new-client-id" });
      }
      if (table === "bookings") {
        bookingsCallCount++;
        if (bookingsCallCount === 1) {
          // conflict check
          return buildChain(options.conflicting ?? []);
        }
        // create booking
        return buildChain(
          options.booking !== undefined ? options.booking : { id: "booking-new", starts_at: "2026-04-10T09:00:00Z", ends_at: "2026-04-10T09:30:00Z", status: "pending" },
          options.bookingError ?? null,
        );
      }
      return buildChain([]);
    }),
  };
}

function reserveReq(slug: string, body: unknown, headers: Record<string, string> = {}) {
  return new NextRequest(`http://localhost/api/v1/booking/${slug}/reserve`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-requested-with": "XMLHttpRequest", ...headers },
    body: JSON.stringify(body),
  });
}

const validBody = {
  client_name: "Jean Petit",
  client_phone: "+33600000001",
  practitioner_id: VALID_UUID,
  service_id: VALID_UUID,
  starts_at: "2026-04-10T09:00:00Z",
};

describe("POST /api/v1/booking/:slug/reserve — validation", () => {
  beforeEach(() => {
    vi.mocked(createAdminClient).mockReturnValue(
      makeReserveSb() as unknown as ReturnType<typeof createAdminClient>,
    );
  });

  it("retourne 404 si salon introuvable", async () => {
    vi.mocked(createAdminClient).mockReturnValue(
      makeReserveSb({ merchant: null }) as unknown as ReturnType<typeof createAdminClient>,
    );

    const res = await POST(reserveReq("unknown", validBody), routeCtx("unknown"));
    expect(res.status).toBe(404);
  });

  it("retourne 400 si client_name vide", async () => {
    const res = await POST(reserveReq("salon-test", { ...validBody, client_name: "" }), routeCtx("salon-test"));
    expect(res.status).toBe(400);
  });

  it("retourne 400 si client_phone trop court", async () => {
    const res = await POST(reserveReq("salon-test", { ...validBody, client_phone: "123" }), routeCtx("salon-test"));
    expect(res.status).toBe(400);
  });

  it("retourne 400 si practitioner_id non-UUID", async () => {
    const res = await POST(reserveReq("salon-test", { ...validBody, practitioner_id: "bad" }), routeCtx("salon-test"));
    expect(res.status).toBe(400);
  });

  it("retourne 400 si service_id non-UUID", async () => {
    const res = await POST(reserveReq("salon-test", { ...validBody, service_id: "bad" }), routeCtx("salon-test"));
    expect(res.status).toBe(400);
  });

  it("retourne 400 si starts_at non-ISO", async () => {
    const res = await POST(reserveReq("salon-test", { ...validBody, starts_at: "10 avril 2026" }), routeCtx("salon-test"));
    expect(res.status).toBe(400);
  });

  it("retourne 400 si JSON invalide", async () => {
    const req = new NextRequest("http://localhost/api/v1/booking/salon-test/reserve", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-requested-with": "XMLHttpRequest" },
      body: "not-json",
    });
    const res = await POST(req, routeCtx("salon-test"));
    expect(res.status).toBe(400);
  });
});

describe("POST /api/v1/booking/:slug/reserve — CSRF", () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_APP_URL = "https://app.plan.fr";
    vi.mocked(createAdminClient).mockReturnValue(
      makeReserveSb() as unknown as ReturnType<typeof createAdminClient>,
    );
  });

  it("retourne 403 si origin ne correspond pas à APP_URL", async () => {
    const res = await POST(
      reserveReq("salon-test", validBody, { origin: "https://evil.com" }),
      routeCtx("salon-test"),
    );
    expect(res.status).toBe(403);
    const body = await res.json() as { code: string };
    expect(body.code).toBe("CSRF_ORIGIN_MISMATCH");
  });

  it("accepte si origin correspond à APP_URL", async () => {
    const res = await POST(
      reserveReq("salon-test", validBody, { origin: "https://app.plan.fr" }),
      routeCtx("salon-test"),
    );
    expect(res.status).not.toBe(403);
  });

  it("retourne 403 si origin est un URL malformé", async () => {
    const res = await POST(
      reserveReq("salon-test", validBody, { origin: "not-a-url" }),
      routeCtx("salon-test"),
    );
    expect(res.status).toBe(403);
  });

  it("retourne 403 si ni Origin ni X-Requested-With", async () => {
    // Requête brute sans x-requested-with ni origin
    const rawReq = new NextRequest("http://localhost/api/v1/booking/salon-test/reserve", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(validBody),
    });
    const res = await POST(
      rawReq,
      routeCtx("salon-test"),
    );
    expect(res.status).toBe(403);
    const body = await res.json() as { code: string };
    expect(body.code).toBe("CSRF_MISSING_ORIGIN");
  });

  it("accepte si X-Requested-With présent sans Origin", async () => {
    const res = await POST(
      reserveReq("salon-test", validBody, { "x-requested-with": "XMLHttpRequest" }),
      routeCtx("salon-test"),
    );
    expect(res.status).not.toBe(403);
  });
});

describe("POST /api/v1/booking/:slug/reserve — sécurité métier", () => {
  beforeEach(() => {
    delete process.env.NEXT_PUBLIC_APP_URL;
    delete process.env.VERCEL_URL;
  });

  it("retourne 404 si le praticien n'appartient pas au salon", async () => {
    vi.mocked(createAdminClient).mockReturnValue(
      makeReserveSb({ practitioner: null }) as unknown as ReturnType<typeof createAdminClient>,
    );

    const res = await POST(reserveReq("salon-test", validBody), routeCtx("salon-test"));
    expect(res.status).toBe(404);
    const body = await res.json() as { error: string };
    expect(body.error).toBe("Practitioner not found");
  });

  it("retourne 404 si le service n'appartient pas au salon", async () => {
    vi.mocked(createAdminClient).mockReturnValue(
      makeReserveSb({ service: null }) as unknown as ReturnType<typeof createAdminClient>,
    );

    const res = await POST(reserveReq("salon-test", validBody), routeCtx("salon-test"));
    expect(res.status).toBe(404);
    const body = await res.json() as { error: string };
    expect(body.error).toBe("Service not found");
  });

  it("retourne 409 si le créneau est déjà pris", async () => {
    vi.mocked(createAdminClient).mockReturnValue(
      makeReserveSb({ conflicting: [{ id: "existing-booking" }] }) as unknown as ReturnType<typeof createAdminClient>,
    );

    const res = await POST(reserveReq("salon-test", validBody), routeCtx("salon-test"));
    expect(res.status).toBe(409);
    const body = await res.json() as { code: string };
    expect(body.code).toBe("SLOT_CONFLICT");
  });
});

describe("POST /api/v1/booking/:slug/reserve — nominal", () => {
  beforeEach(() => {
    delete process.env.NEXT_PUBLIC_APP_URL;
    delete process.env.VERCEL_URL;
  });

  it("retourne 201 avec le booking créé (nouveau client)", async () => {
    vi.mocked(createAdminClient).mockReturnValue(
      makeReserveSb() as unknown as ReturnType<typeof createAdminClient>,
    );

    const res = await POST(reserveReq("salon-test", validBody), routeCtx("salon-test"));
    expect(res.status).toBe(201);
    const body = await res.json() as { data: { id: string; status: string; message: string } };
    expect(body.data.id).toBeDefined();
    expect(body.data.status).toBe("pending");
    expect(body.data.message).toContain("rendez-vous");
  });

  it("retourne 201 avec client existant (même téléphone)", async () => {
    vi.mocked(createAdminClient).mockReturnValue(
      makeReserveSb({ existingClient: { id: "existing-client-id" } }) as unknown as ReturnType<typeof createAdminClient>,
    );

    const res = await POST(reserveReq("salon-test", validBody), routeCtx("salon-test"));
    expect(res.status).toBe(201);
  });
});
