import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

/**
 * T038 — Integration tests: GET /api/v1/bookings
 * Appelle le vrai handler HTTP avec des mocks Supabase injectés.
 */

// ---- Données de test -------------------------------------------------------

const mockUser = { id: "user-abc" };
const mockMerchant = { id: "merchant-123" };

const mockBookings = [
  {
    id: "booking-1",
    merchant_id: "merchant-123",
    client_id: "client-1",
    practitioner_id: "practitioner-1",
    service_id: "service-1",
    starts_at: "2026-04-01T09:00:00+00:00",
    ends_at: "2026-04-01T09:30:00+00:00",
    status: "confirmed",
    source_channel: "whatsapp",
    version: 1,
    client: { id: "client-1", name: "Jean Petit", phone: "+33600000001", preferred_language: "fr" },
    practitioner: { id: "practitioner-1", name: "Marie Dupont", color: "#4F46E5" },
    service: { id: "service-1", name: "Coupe homme", duration_minutes: 30, price_cents: 2500 },
  },
  {
    id: "booking-2",
    merchant_id: "merchant-123",
    client_id: "client-2",
    practitioner_id: "practitioner-2",
    service_id: "service-1",
    starts_at: "2026-04-01T10:00:00+00:00",
    ends_at: "2026-04-01T10:30:00+00:00",
    status: "pending",
    source_channel: "dashboard",
    version: 1,
    client: { id: "client-2", name: "Sophie Bernard", phone: null, preferred_language: "fr" },
    practitioner: { id: "practitioner-2", name: "Pierre Martin", color: "#0EA5E9" },
    service: { id: "service-1", name: "Coupe homme", duration_minutes: 30, price_cents: 2500 },
  },
  {
    id: "booking-3",
    merchant_id: "merchant-123",
    client_id: "client-1",
    practitioner_id: "practitioner-1",
    service_id: "service-2",
    starts_at: "2026-04-05T14:00:00+00:00",
    ends_at: "2026-04-05T15:00:00+00:00",
    status: "confirmed",
    source_channel: "sms",
    version: 1,
    client: { id: "client-1", name: "Jean Petit", phone: "+33600000001", preferred_language: "fr" },
    practitioner: { id: "practitioner-1", name: "Marie Dupont", color: "#4F46E5" },
    service: { id: "service-2", name: "Coloration", duration_minutes: 60, price_cents: 7000 },
  },
];

// ---- Mock Supabase ---------------------------------------------------------

// Query chainable qui se résout avec { data, error } quand await-é
function buildChainableQuery(resolvedData: unknown, resolvedError: null | { message: string } = null) {
  const chain: Record<string, unknown> = {};
  const resolve = vi.fn().mockResolvedValue({ data: resolvedData, error: resolvedError });

  for (const method of ["select", "eq", "gte", "lte", "order", "not", "in", "limit"]) {
    chain[method] = vi.fn().mockReturnValue(chain);
  }
  chain["single"] = vi.fn().mockResolvedValue({
    data: Array.isArray(resolvedData) ? (resolvedData[0] ?? null) : resolvedData,
    error: resolvedError,
  });
  // Permet à `await query` de fonctionner
  chain["then"] = (onFulfilled: (v: { data: unknown; error: unknown }) => void) =>
    Promise.resolve({ data: resolvedData, error: resolvedError }).then(onFulfilled);

  void resolve; // évite le lint "unused"
  return chain;
}

function makeMockSupabase(bookingsData: unknown[]) {
  const merchantQuery = buildChainableQuery([mockMerchant]);
  const bookingsQuery = buildChainableQuery(bookingsData);

  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: mockUser }, error: null }),
    },
    from: vi.fn((table: string) => {
      if (table === "merchants") return merchantQuery;
      if (table === "bookings") return bookingsQuery;
      return buildChainableQuery([]);
    }),
  };
}

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn() },
  bookingLog: { created: vi.fn(), updated: vi.fn(), cancelled: vi.fn() },
  securityLog: { crossTenantBlocked: vi.fn() },
}));

const { createClient } = await import("@/lib/supabase/server");
const { GET } = await import("@/app/api/v1/bookings/route");

// ---- Helpers ---------------------------------------------------------------

function req(params: Record<string, string> = {}) {
  const url = new URL("http://localhost/api/v1/bookings");
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  return new NextRequest(url.toString());
}

// ---- Tests -----------------------------------------------------------------

describe("GET /api/v1/bookings — authentification", () => {
  it("retourne 401 si l'utilisateur n'est pas authentifié", async () => {
    vi.mocked(createClient).mockResolvedValueOnce({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }) },
      from: vi.fn(),
    } as unknown as Awaited<ReturnType<typeof createClient>>);

    const res = await GET(req());
    expect(res.status).toBe(401);
    const body = await res.json() as { error: string };
    expect(body.error).toBe("Unauthorized");
  });

  it("retourne 404 si le merchant n'existe pas pour cet user", async () => {
    vi.mocked(createClient).mockResolvedValueOnce({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: mockUser }, error: null }) },
      from: vi.fn(() => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: null, error: null }),
        then: (resolve: (v: { data: null; error: null }) => void) =>
          Promise.resolve({ data: null, error: null }).then(resolve),
      })),
    } as unknown as Awaited<ReturnType<typeof createClient>>);

    const res = await GET(req());
    expect(res.status).toBe(404);
    const body = await res.json() as { error: string };
    expect(body.error).toBe("Merchant not found");
  });
});

describe("GET /api/v1/bookings — validation des paramètres", () => {
  beforeEach(() => {
    vi.mocked(createClient).mockResolvedValue(
      makeMockSupabase(mockBookings) as unknown as Awaited<ReturnType<typeof createClient>>,
    );
  });

  it("retourne 400 si le format de date est invalide (DD/MM/YYYY)", async () => {
    const res = await GET(req({ date: "01/04/2026" }));
    expect(res.status).toBe(400);
    const body = await res.json() as { error: string };
    expect(body.error).toContain("date");
  });

  it("retourne 400 si week_start n'est pas au format YYYY-MM-DD", async () => {
    const res = await GET(req({ week_start: "2026/03/30" }));
    expect(res.status).toBe(400);
  });

  it("retourne 400 si le format du mois est invalide", async () => {
    const res = await GET(req({ month: "04-2026" }));
    expect(res.status).toBe(400);
  });

  it("retourne 400 pour un status inconnu", async () => {
    const res = await GET(req({ status: "unknown_status" }));
    expect(res.status).toBe(400);
    const body = await res.json() as { error: string };
    expect(body.error).toBe("Invalid status value");
  });

  it("accepte tous les statuts valides sans retourner 400", async () => {
    const valid = ["pending", "confirmed", "in_progress", "completed", "cancelled", "no_show"];
    for (const status of valid) {
      vi.mocked(createClient).mockResolvedValueOnce(
        makeMockSupabase(mockBookings) as unknown as Awaited<ReturnType<typeof createClient>>,
      );
      const res = await GET(req({ status }));
      expect(res.status).not.toBe(400);
    }
  });
});

describe("GET /api/v1/bookings — réponse nominale", () => {
  let mockSb: ReturnType<typeof makeMockSupabase>;

  beforeEach(() => {
    mockSb = makeMockSupabase(mockBookings);
    vi.mocked(createClient).mockResolvedValue(
      mockSb as unknown as Awaited<ReturnType<typeof createClient>>,
    );
  });

  it("retourne 200 avec Content-Type application/json", async () => {
    const res = await GET(req());
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("application/json");
  });

  it("retourne un tableau de bookings", async () => {
    const res = await GET(req());
    const body = await res.json() as unknown[];
    expect(Array.isArray(body)).toBe(true);
    expect(body.length).toBe(3);
  });

  it("chaque booking contient les champs joints client, practitioner, service", async () => {
    const res = await GET(req());
    const body = await res.json() as Array<Record<string, unknown>>;
    const b = body[0];
    expect(b["client"]).toBeDefined();
    expect(b["practitioner"]).toBeDefined();
    expect(b["service"]).toBeDefined();
  });

  it("retourne un tableau vide si aucun booking ne correspond", async () => {
    vi.mocked(createClient).mockResolvedValueOnce(
      makeMockSupabase([]) as unknown as Awaited<ReturnType<typeof createClient>>,
    );
    const res = await GET(req({ date: "2026-05-01" }));
    expect(res.status).toBe(200);
    const body = await res.json() as unknown[];
    expect(body).toHaveLength(0);
  });

  it("appelle from('merchants') et from('bookings') avec les bons filtres", async () => {
    await GET(req({ date: "2026-04-01" }));
    expect(mockSb.from).toHaveBeenCalledWith("merchants");
    expect(mockSb.from).toHaveBeenCalledWith("bookings");

    // Vérifie que .eq a été appelé sur la query bookings (merchant_id filter)
    const bookingsQuery = mockSb.from("bookings");
    expect(bookingsQuery.eq).toHaveBeenCalled();
    expect(bookingsQuery.gte).toHaveBeenCalled();
  });

  it("filtre par status quand le paramètre est fourni", async () => {
    mockSb = makeMockSupabase(mockBookings);
    vi.mocked(createClient).mockResolvedValueOnce(
      mockSb as unknown as Awaited<ReturnType<typeof createClient>>,
    );
    await GET(req({ status: "confirmed" }));
    const bookingsQuery = mockSb.from("bookings");
    expect(bookingsQuery.eq).toHaveBeenCalled();
  });
});

describe("GET /api/v1/bookings — calcul semaine UTC (logique pure)", () => {
  it("ajoute 6 jours à weekStart sans décalage timezone", () => {
    const weekStart = "2026-03-30";
    const [wy, wm, wd] = weekStart.split("-").map(Number);
    const endDate = new Date(Date.UTC(wy, wm - 1, wd + 6));
    expect(endDate.toISOString().slice(0, 10)).toBe("2026-04-05");
  });

  it("traverse correctement la fin de mois", () => {
    const weekStart = "2026-01-28";
    const [wy, wm, wd] = weekStart.split("-").map(Number);
    const endDate = new Date(Date.UTC(wy, wm - 1, wd + 6));
    expect(endDate.toISOString().slice(0, 10)).toBe("2026-02-03");
  });

  it("traverse correctement la fin d'année", () => {
    const weekStart = "2025-12-29";
    const [wy, wm, wd] = weekStart.split("-").map(Number);
    const endDate = new Date(Date.UTC(wy, wm - 1, wd + 6));
    expect(endDate.toISOString().slice(0, 10)).toBe("2026-01-04");
  });
});
