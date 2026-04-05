import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

/**
 * Tests: POST /api/v1/bookings + PATCH /api/v1/bookings/:id
 */

const mockUser = { id: "user-abc" };
const mockMerchant = { id: "merchant-123" };
const VALID_UUID = "a1b2c3d4-e5f6-7890-abcd-ef1234567890";
const VALID_DT = "2026-04-07T09:00:00+02:00";
const VALID_DT_END = "2026-04-07T09:30:00+02:00";

const mockBooking = {
  id: "booking-1",
  merchant_id: "merchant-123",
  client_id: VALID_UUID,
  practitioner_id: VALID_UUID,
  service_id: VALID_UUID,
  starts_at: VALID_DT,
  ends_at: VALID_DT_END,
  status: "confirmed",
  source_channel: "dashboard",
  version: 1,
};

// ---- Mock Supabase ---------------------------------------------------------

function buildChain(resolvedData: unknown, resolvedError: null | { message: string; code?: string } = null) {
  const chain: Record<string, unknown> = {};
  for (const method of ["select", "eq", "gte", "lte", "order", "not", "in", "limit", "update", "insert", "range"]) {
    chain[method] = vi.fn().mockReturnValue(chain);
  }
  chain["single"] = vi.fn().mockResolvedValue({ data: resolvedData, error: resolvedError });
  chain["then"] = (onFulfilled: (v: { data: unknown; error: unknown }) => void) =>
    Promise.resolve({ data: resolvedData, error: resolvedError }).then(onFulfilled);
  return chain;
}

function makeMockSb(options: {
  booking?: unknown;
  bookingError?: { message: string; code?: string } | null;
  existingBooking?: unknown;
} = {}) {
  // PATCH appelle from("bookings") deux fois :
  // 1ère fois = fetchExistingBooking (ownership check)
  // 2ème fois = update avec eq("version")
  let bookingsCallCount = 0;
  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: mockUser }, error: null }),
    },
    from: vi.fn((table: string) => {
      if (table === "merchants") return buildChain(mockMerchant);
      if (table === "bookings") {
        bookingsCallCount++;
        if (bookingsCallCount === 1) {
          // 1ère requête = existingBooking
          return buildChain(options.existingBooking !== undefined ? options.existingBooking : mockBooking);
        }
        // 2ème requête = update
        const updateData = options.booking !== undefined ? options.booking : mockBooking;
        return buildChain(updateData, options.bookingError ?? null);
      }
      return buildChain([]);
    }),
  };
}

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn() },
  bookingLog: { created: vi.fn(), updated: vi.fn(), cancelled: vi.fn(), versionConflict: vi.fn() },
  securityLog: { crossTenantBlocked: vi.fn() },
}));
vi.mock("@/lib/channels/send", () => ({ sendMessage: vi.fn().mockResolvedValue(undefined) }));

const { createClient } = await import("@/lib/supabase/server");
const { POST } = await import("@/app/api/v1/bookings/route");
const { PATCH } = await import("@/app/api/v1/bookings/[id]/route");

// ---- Helpers ---------------------------------------------------------------

function postReq(body: unknown) {
  return new NextRequest("http://localhost/api/v1/bookings", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function patchReq(id: string, body: unknown) {
  return new NextRequest(`http://localhost/api/v1/bookings/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

const routeCtx = (id: string) => ({ params: Promise.resolve({ id }) });

// ---- POST /api/v1/bookings -------------------------------------------------

describe("POST /api/v1/bookings — auth", () => {
  it("retourne 401 si non authentifié", async () => {
    vi.mocked(createClient).mockResolvedValueOnce({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }) },
      from: vi.fn(),
    } as unknown as Awaited<ReturnType<typeof createClient>>);

    const res = await POST(postReq({ client_id: VALID_UUID, practitioner_id: VALID_UUID, service_id: VALID_UUID, starts_at: VALID_DT, ends_at: VALID_DT_END }));
    expect(res.status).toBe(401);
    const body = await res.json() as { error: string };
    expect(body.error).toBe("Unauthorized");
  });

  it("retourne 404 si merchant introuvable", async () => {
    vi.mocked(createClient).mockResolvedValueOnce({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: mockUser }, error: null }) },
      from: vi.fn(() => buildChain(null)),
    } as unknown as Awaited<ReturnType<typeof createClient>>);

    const res = await POST(postReq({ client_id: VALID_UUID, practitioner_id: VALID_UUID, service_id: VALID_UUID, starts_at: VALID_DT, ends_at: VALID_DT_END }));
    expect(res.status).toBe(404);
  });
});

describe("POST /api/v1/bookings — validation", () => {
  beforeEach(() => {
    vi.mocked(createClient).mockResolvedValue(
      makeMockSb() as unknown as Awaited<ReturnType<typeof createClient>>,
    );
  });

  it("retourne 422 si client_id invalide", async () => {
    const res = await POST(postReq({ client_id: "not-uuid", practitioner_id: VALID_UUID, service_id: VALID_UUID, starts_at: VALID_DT, ends_at: VALID_DT_END }));
    expect(res.status).toBe(422);
  });

  it("retourne 422 si starts_at manquant", async () => {
    const res = await POST(postReq({ client_id: VALID_UUID, practitioner_id: VALID_UUID, service_id: VALID_UUID, ends_at: VALID_DT_END }));
    expect(res.status).toBe(422);
  });

  it("retourne 400 si JSON invalide", async () => {
    const req = new NextRequest("http://localhost/api/v1/bookings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "not-json",
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("retourne 422 si source_channel invalide", async () => {
    const res = await POST(postReq({ client_id: VALID_UUID, practitioner_id: VALID_UUID, service_id: VALID_UUID, starts_at: VALID_DT, ends_at: VALID_DT_END, source_channel: "email" }));
    expect(res.status).toBe(422);
  });
});

describe("POST /api/v1/bookings — nominal", () => {
  it("retourne 201 avec le booking créé", async () => {
    vi.mocked(createClient).mockResolvedValue(
      makeMockSb({ booking: mockBooking }) as unknown as Awaited<ReturnType<typeof createClient>>,
    );

    const res = await POST(postReq({
      client_id: VALID_UUID,
      practitioner_id: VALID_UUID,
      service_id: VALID_UUID,
      starts_at: VALID_DT,
      ends_at: VALID_DT_END,
    }));
    expect(res.status).toBe(201);
    const body = await res.json() as { id: string };
    expect(body.id).toBe("booking-1");
  });

  it("accepte source_channel = whatsapp", async () => {
    vi.mocked(createClient).mockResolvedValue(
      makeMockSb({ booking: { ...mockBooking, source_channel: "whatsapp" } }) as unknown as Awaited<ReturnType<typeof createClient>>,
    );

    const res = await POST(postReq({
      client_id: VALID_UUID,
      practitioner_id: VALID_UUID,
      service_id: VALID_UUID,
      starts_at: VALID_DT,
      ends_at: VALID_DT_END,
      source_channel: "whatsapp",
    }));
    expect(res.status).toBe(201);
  });
});

// ---- PATCH /api/v1/bookings/:id --------------------------------------------

describe("PATCH /api/v1/bookings/:id — auth", () => {
  it("retourne 401 si non authentifié", async () => {
    vi.mocked(createClient).mockResolvedValueOnce({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }) },
      from: vi.fn(),
    } as unknown as Awaited<ReturnType<typeof createClient>>);

    const res = await PATCH(patchReq("booking-1", { version: 0, status: "confirmed" }), routeCtx("booking-1"));
    expect(res.status).toBe(401);
  });

  it("retourne 404 si booking n'appartient pas au merchant", async () => {
    const sb = {
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: mockUser }, error: null }) },
      from: vi.fn((table: string) => {
        if (table === "merchants") return buildChain(mockMerchant);
        if (table === "bookings") {
          const chain = buildChain(null);
          chain["single"] = vi.fn().mockResolvedValue({ data: null, error: null });
          return chain;
        }
        return buildChain(null);
      }),
    };
    vi.mocked(createClient).mockResolvedValueOnce(sb as unknown as Awaited<ReturnType<typeof createClient>>);

    const res = await PATCH(patchReq("booking-1", { version: 0, status: "confirmed" }), routeCtx("booking-1"));
    expect(res.status).toBe(404);
  });
});

describe("PATCH /api/v1/bookings/:id — validation", () => {
  beforeEach(() => {
    vi.mocked(createClient).mockResolvedValue(
      makeMockSb() as unknown as Awaited<ReturnType<typeof createClient>>,
    );
  });

  it("retourne 422 si version manquante", async () => {
    const res = await PATCH(patchReq("booking-1", { status: "confirmed" }), routeCtx("booking-1"));
    expect(res.status).toBe(422);
  });

  it("retourne 422 si status invalide", async () => {
    const res = await PATCH(patchReq("booking-1", { version: 0, status: "unknown" }), routeCtx("booking-1"));
    expect(res.status).toBe(422);
  });

  it("retourne 400 si JSON invalide", async () => {
    const req = new NextRequest("http://localhost/api/v1/bookings/booking-1", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: "not-json",
    });
    const res = await PATCH(req, routeCtx("booking-1"));
    expect(res.status).toBe(400);
  });
});

describe("PATCH /api/v1/bookings/:id — nominal", () => {
  it("retourne 200 avec le booking mis à jour", async () => {
    const updated = { ...mockBooking, status: "confirmed", version: 2 };
    vi.mocked(createClient).mockResolvedValue(
      makeMockSb({ booking: updated }) as unknown as Awaited<ReturnType<typeof createClient>>,
    );

    const res = await PATCH(patchReq("booking-1", { version: 1, status: "confirmed" }), routeCtx("booking-1"));
    expect(res.status).toBe(200);
    const body = await res.json() as { status: string; version: number };
    expect(body.status).toBe("confirmed");
    expect(body.version).toBe(2);
  });

  it("retourne 409 en cas de conflit de version (PGRST116)", async () => {
    vi.mocked(createClient).mockResolvedValue(
      makeMockSb({
        booking: null,
        bookingError: { message: "Row not found", code: "PGRST116" },
      }) as unknown as Awaited<ReturnType<typeof createClient>>,
    );

    const res = await PATCH(patchReq("booking-1", { version: 0, status: "confirmed" }), routeCtx("booking-1"));
    expect(res.status).toBe(409);
    const body = await res.json() as { code: string };
    expect(body.code).toBe("VERSION_CONFLICT");
  });
});
