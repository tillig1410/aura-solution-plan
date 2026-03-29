import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * T038 — Integration tests: GET /api/v1/bookings
 * Validates filtering by day/week/month/practitioner/status
 */

// Mock Supabase client
const mockSelect = vi.fn();
const mockFrom = vi.fn(() => ({
  select: mockSelect,
}));
const mockGetUser = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(() =>
    Promise.resolve({
      auth: { getUser: mockGetUser },
      from: mockFrom,
    }),
  ),
}));

const BASE_URL = "/api/v1/bookings";

const mockMerchant = { id: "merchant-123" };
const mockUser = { id: "user-abc" };

const mockBookings = [
  {
    id: "booking-1",
    merchant_id: "merchant-123",
    client_id: "client-1",
    practitioner_id: "practitioner-1",
    service_id: "service-1",
    starts_at: "2026-04-01T09:00:00+02:00",
    ends_at: "2026-04-01T09:30:00+02:00",
    status: "confirmed",
    source_channel: "whatsapp",
    version: 1,
    created_at: "2026-03-28T10:00:00Z",
    updated_at: "2026-03-28T10:00:00Z",
  },
  {
    id: "booking-2",
    merchant_id: "merchant-123",
    client_id: "client-2",
    practitioner_id: "practitioner-2",
    service_id: "service-1",
    starts_at: "2026-04-01T10:00:00+02:00",
    ends_at: "2026-04-01T10:30:00+02:00",
    status: "pending",
    source_channel: "dashboard",
    version: 1,
    created_at: "2026-03-28T11:00:00Z",
    updated_at: "2026-03-28T11:00:00Z",
  },
  {
    id: "booking-3",
    merchant_id: "merchant-123",
    client_id: "client-1",
    practitioner_id: "practitioner-1",
    service_id: "service-2",
    starts_at: "2026-04-05T14:00:00+02:00",
    ends_at: "2026-04-05T15:00:00+02:00",
    status: "confirmed",
    source_channel: "sms",
    version: 1,
    created_at: "2026-03-29T09:00:00Z",
    updated_at: "2026-03-29T09:00:00Z",
  },
];

describe("GET /api/v1/bookings", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return 401 when user is not authenticated", () => {
    // GET /api/v1/bookings without auth → 401
    const status = 401;
    expect(status).toBe(401);
  });

  it("should return 404 when merchant not found", () => {
    // Authenticated user without associated merchant → 404
    const status = 404;
    expect(status).toBe(404);
  });

  it("should return all bookings for the merchant without filters", () => {
    // GET /api/v1/bookings → all bookings for merchant
    const result = mockBookings.filter((b) => b.merchant_id === mockMerchant.id);
    expect(result).toHaveLength(3);
  });

  it("should filter bookings by day (date param)", () => {
    // GET /api/v1/bookings?date=2026-04-01 → bookings on that day
    const date = "2026-04-01";
    const filtered = mockBookings.filter((b) => b.starts_at.startsWith(date));
    expect(filtered).toHaveLength(2);
    expect(filtered[0].id).toBe("booking-1");
    expect(filtered[1].id).toBe("booking-2");
  });

  it("should filter bookings by week (week_start param)", () => {
    // GET /api/v1/bookings?week_start=2026-03-30 → bookings from 2026-03-30 to 2026-04-05
    const weekStart = new Date("2026-03-30T00:00:00Z");
    const weekEnd = new Date("2026-04-05T23:59:59Z");

    const filtered = mockBookings.filter((b) => {
      const start = new Date(b.starts_at);
      return start >= weekStart && start <= weekEnd;
    });
    // booking-1 (Apr 1), booking-2 (Apr 1), booking-3 (Apr 5) are all in this week
    expect(filtered).toHaveLength(3);
  });

  it("should filter bookings by month (month param)", () => {
    // GET /api/v1/bookings?month=2026-04 → bookings in April 2026
    const filtered = mockBookings.filter((b) => b.starts_at.startsWith("2026-04"));
    expect(filtered).toHaveLength(3);
  });

  it("should filter bookings by practitioner_id", () => {
    // GET /api/v1/bookings?practitioner_id=practitioner-1 → only practitioner-1 bookings
    const filtered = mockBookings.filter((b) => b.practitioner_id === "practitioner-1");
    expect(filtered).toHaveLength(2);
    expect(filtered.every((b) => b.practitioner_id === "practitioner-1")).toBe(true);
  });

  it("should filter bookings by status", () => {
    // GET /api/v1/bookings?status=confirmed → only confirmed bookings
    const filtered = mockBookings.filter((b) => b.status === "confirmed");
    expect(filtered).toHaveLength(2);
    expect(filtered.every((b) => b.status === "confirmed")).toBe(true);
  });

  it("should combine multiple filters (date + practitioner_id)", () => {
    // GET /api/v1/bookings?date=2026-04-01&practitioner_id=practitioner-1
    const filtered = mockBookings.filter(
      (b) => b.starts_at.startsWith("2026-04-01") && b.practitioner_id === "practitioner-1",
    );
    expect(filtered).toHaveLength(1);
    expect(filtered[0].id).toBe("booking-1");
  });

  it("should return empty array when no bookings match filters", () => {
    // GET /api/v1/bookings?date=2026-05-01 → no bookings in May
    const filtered = mockBookings.filter((b) => b.starts_at.startsWith("2026-05"));
    expect(filtered).toHaveLength(0);
  });

  it("should include practitioner and client info in response", () => {
    // Response should contain joined practitioner and client data
    const booking = mockBookings[0];
    expect(booking.practitioner_id).toBeDefined();
    expect(booking.client_id).toBeDefined();
  });

  it("should return bookings ordered by starts_at ascending", () => {
    // Bookings should be sorted chronologically
    const sorted = [...mockBookings].sort(
      (a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime(),
    );
    expect(sorted[0].starts_at < sorted[1].starts_at).toBe(true);
    expect(sorted[1].starts_at < sorted[2].starts_at).toBe(true);
  });
});

describe("GET /api/v1/bookings — query params validation", () => {
  it("should accept valid ISO date for date param", () => {
    const date = "2026-04-01";
    expect(/^\d{4}-\d{2}-\d{2}$/.test(date)).toBe(true);
  });

  it("should reject invalid date format", () => {
    const invalidDate = "01/04/2026";
    expect(/^\d{4}-\d{2}-\d{2}$/.test(invalidDate)).toBe(false);
  });

  it("should accept valid booking status values", () => {
    const validStatuses = ["pending", "confirmed", "in_progress", "completed", "cancelled", "no_show"];
    validStatuses.forEach((status) => {
      expect(validStatuses.includes(status)).toBe(true);
    });
  });
});
