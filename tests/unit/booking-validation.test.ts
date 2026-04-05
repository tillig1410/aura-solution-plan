import { describe, it, expect } from "vitest";
import { createBookingSchema, updateBookingSchema } from "@/lib/validations/booking";

/**
 * T072 — Unit tests: Booking Zod validation schemas
 * Pure validation — pas de mock nécessaire.
 */

const VALID_UUID = "a1b2c3d4-e5f6-7890-abcd-ef1234567890";
const VALID_DT = "2026-04-07T09:00:00+02:00";

// ---- createBookingSchema ----------------------------------------------------

describe("createBookingSchema — POST /api/v1/bookings", () => {
  it("accepte un booking valide complet", () => {
    const input = {
      client_id: VALID_UUID,
      practitioner_id: VALID_UUID,
      service_id: VALID_UUID,
      starts_at: VALID_DT,
      ends_at: "2026-04-07T09:30:00+02:00",
      source_channel: "whatsapp",
    };

    const result = createBookingSchema.safeParse(input);
    expect(result.success).toBe(true);
  });

  it("applique le default source_channel = dashboard", () => {
    const input = {
      client_id: VALID_UUID,
      practitioner_id: VALID_UUID,
      service_id: VALID_UUID,
      starts_at: VALID_DT,
      ends_at: "2026-04-07T09:30:00+02:00",
    };

    const result = createBookingSchema.safeParse(input);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.source_channel).toBe("dashboard");
    }
  });

  it("rejette un client_id non-UUID", () => {
    const input = {
      client_id: "not-a-uuid",
      practitioner_id: VALID_UUID,
      service_id: VALID_UUID,
      starts_at: VALID_DT,
      ends_at: "2026-04-07T09:30:00+02:00",
    };

    const result = createBookingSchema.safeParse(input);
    expect(result.success).toBe(false);
  });

  it("rejette un starts_at sans timezone offset", () => {
    const input = {
      client_id: VALID_UUID,
      practitioner_id: VALID_UUID,
      service_id: VALID_UUID,
      starts_at: "2026-04-07T09:00:00", // pas d'offset
      ends_at: "2026-04-07T09:30:00+02:00",
    };

    const result = createBookingSchema.safeParse(input);
    expect(result.success).toBe(false);
  });

  it("rejette si client_id manquant", () => {
    const input = {
      practitioner_id: VALID_UUID,
      service_id: VALID_UUID,
      starts_at: VALID_DT,
      ends_at: "2026-04-07T09:30:00+02:00",
    };

    const result = createBookingSchema.safeParse(input);
    expect(result.success).toBe(false);
  });

  it("rejette un source_channel invalide", () => {
    const input = {
      client_id: VALID_UUID,
      practitioner_id: VALID_UUID,
      service_id: VALID_UUID,
      starts_at: VALID_DT,
      ends_at: "2026-04-07T09:30:00+02:00",
      source_channel: "email",
    };

    const result = createBookingSchema.safeParse(input);
    expect(result.success).toBe(false);
  });

  it("accepte tous les source_channel valides", () => {
    const channels = ["whatsapp", "messenger", "telegram", "sms", "voice", "dashboard", "booking_page"];
    for (const channel of channels) {
      const result = createBookingSchema.safeParse({
        client_id: VALID_UUID,
        practitioner_id: VALID_UUID,
        service_id: VALID_UUID,
        starts_at: VALID_DT,
        ends_at: "2026-04-07T09:30:00+02:00",
        source_channel: channel,
      });
      expect(result.success).toBe(true);
    }
  });
});

// ---- updateBookingSchema ----------------------------------------------------

describe("updateBookingSchema — PATCH /api/v1/bookings/:id", () => {
  it("accepte un update valide avec version + status", () => {
    const result = updateBookingSchema.safeParse({ version: 1, status: "confirmed" });
    expect(result.success).toBe(true);
  });

  it("accepte un update avec version + starts_at/ends_at", () => {
    const result = updateBookingSchema.safeParse({
      version: 0,
      starts_at: VALID_DT,
      ends_at: "2026-04-07T10:00:00+02:00",
    });
    expect(result.success).toBe(true);
  });

  it("rejette si version manquante", () => {
    const result = updateBookingSchema.safeParse({ status: "confirmed" });
    expect(result.success).toBe(false);
  });

  it("rejette si uniquement version sans aucun champ à modifier", () => {
    const result = updateBookingSchema.safeParse({ version: 1 });
    expect(result.success).toBe(false);
  });

  it("rejette un status invalide", () => {
    const result = updateBookingSchema.safeParse({ version: 1, status: "unknown_status" });
    expect(result.success).toBe(false);
  });

  it("rejette un cancelled_by invalide", () => {
    const result = updateBookingSchema.safeParse({ version: 1, cancelled_by: "system" });
    expect(result.success).toBe(false);
  });

  it("accepte cancelled_by = client ou merchant", () => {
    expect(updateBookingSchema.safeParse({ version: 0, cancelled_by: "client" }).success).toBe(true);
    expect(updateBookingSchema.safeParse({ version: 0, cancelled_by: "merchant" }).success).toBe(true);
  });

  it("rejette une version négative", () => {
    const result = updateBookingSchema.safeParse({ version: -1, status: "confirmed" });
    expect(result.success).toBe(false);
  });
});
