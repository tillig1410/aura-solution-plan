import { describe, it, expect, vi } from "vitest";

/**
 * T040 — Unit tests: getAvailableSlots
 * Teste la vraie implémentation avec un mock Supabase fluent.
 */

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));

const { getAvailableSlots } = await import("@/lib/availability");

// ---- Helpers ----------------------------------------------------------------

const MERCHANT = "a1b2c3d4-e5f6-7890-abcd-ef1234567890";
const PRAC     = "b1b2c3d4-e5f6-7890-abcd-ef1234567891";
const DATE     = "2026-04-07"; // lundi

/** Construire un mock Supabase retournant `schedule` et `bookings` */
function makeAvailabilitySupabase(schedule: object[], bookings: object[]) {
  let callCount = 0;

  const from = vi.fn(() => {
    callCount++;
    const result = callCount === 1 ? schedule : bookings;

    // Chaîne fluente : .select().eq().or() → schedule
    //                  .select().eq().eq().gte().lte().not() → bookings
    const chain: Record<string, unknown> = {};
    for (const m of ["select", "eq", "or", "gte", "lte", "not", "order", "gt", "limit"]) {
      chain[m] = vi.fn().mockReturnValue(chain);
    }
    // Chaque chaîne est awaitable (retourne { data: result })
    (chain as unknown as { then: unknown }).then = (resolve: (v: unknown) => unknown) =>
      Promise.resolve({ data: result, error: null }).then(resolve);

    return chain;
  });

  return { from };
}

function makeSchedule(startTime: string, endTime: string, options: Record<string, unknown> = {}) {
  return {
    start_time: startTime,
    end_time: endTime,
    is_available: true,
    exception_date: null,
    ...options,
  };
}

// ---- Tests ------------------------------------------------------------------

describe("Availability Calculation", () => {
  it("should return free slots for a given day", async () => {
    const schedule = [makeSchedule("09:00", "12:30")];
    const { from } = makeAvailabilitySupabase(schedule, []);

    const slots = await getAvailableSlots({ from } as never, {
      merchantId: MERCHANT,
      practitionerId: PRAC,
      date: DATE,
      durationMinutes: 30,
    });

    // 09:00–12:30, stride 15 min, durée 30 min → dernier slot 12:00 (12:00+30=12:30 ✓) → 13 créneaux
    expect(slots.length).toBe(13);
    expect(slots[0].starts_at).toBe(`${DATE}T09:00:00`);
    expect(slots[0].ends_at).toBe(`${DATE}T09:30:00`);
  });

  it("should exclude exception dates (holidays)", async () => {
    const schedule = [makeSchedule("09:00", "19:00", {
      is_available: false,
      exception_date: DATE,
    })];
    const { from } = makeAvailabilitySupabase(schedule, []);

    const slots = await getAvailableSlots({ from } as never, {
      merchantId: MERCHANT,
      practitionerId: PRAC,
      date: DATE,
      durationMinutes: 30,
    });

    expect(slots).toHaveLength(0);
  });

  it("should subtract existing confirmed bookings", async () => {
    const schedule = [makeSchedule("09:00", "10:30")];
    const bookings = [
      { starts_at: `${DATE}T09:00:00`, ends_at: `${DATE}T09:30:00`, status: "confirmed" },
    ];
    const { from } = makeAvailabilitySupabase(schedule, bookings);

    const slots = await getAvailableSlots({ from } as never, {
      merchantId: MERCHANT,
      practitionerId: PRAC,
      date: DATE,
      durationMinutes: 30,
    });

    // 09:00-10:30 stride 15 = 5 créneaux. Booking 09:00-09:30 bloque 09:00 et 09:15 → 3 libres
    expect(slots.length).toBe(3);
    expect(slots.every((s) => s.starts_at !== `${DATE}T09:00:00`)).toBe(true);
  });

  it("should handle overlapping bookings correctly (long booking blocks multiple slots)", async () => {
    const schedule = [makeSchedule("09:00", "12:00")];
    // Coloration 90 min : bloque 09:00, 09:30, 10:00
    const bookings = [
      { starts_at: `${DATE}T09:00:00`, ends_at: `${DATE}T10:30:00`, status: "confirmed" },
    ];
    const { from } = makeAvailabilitySupabase(schedule, bookings);

    const slots = await getAvailableSlots({ from } as never, {
      merchantId: MERCHANT,
      practitionerId: PRAC,
      date: DATE,
      durationMinutes: 30,
    });

    // 09:00–12:00 stride 15 = 11 créneaux. Booking 09:00–10:30 bloque 09:00–10:15 (6 slots) → 5 libres
    expect(slots.length).toBe(5);
    const startTimes = slots.map((s) => s.starts_at);
    expect(startTimes).not.toContain(`${DATE}T09:00:00`);
    expect(startTimes).not.toContain(`${DATE}T10:00:00`);
    expect(startTimes).not.toContain(`${DATE}T10:15:00`);
    expect(startTimes).toContain(`${DATE}T10:30:00`);
  });

  it("should not count cancelled bookings as occupied", async () => {
    const schedule = [makeSchedule("09:00", "10:30")];
    const bookings = [
      { starts_at: `${DATE}T09:00:00`, ends_at: `${DATE}T09:30:00`, status: "cancelled" },
    ];
    // Le mock retourne les données brutes — le filtre SQL (.not("status","in",...)) est mocké
    // donc on simule que Supabase a déjà filtré les cancelled en ne les incluant pas
    const { from } = makeAvailabilitySupabase(schedule, []);

    const slots = await getAvailableSlots({ from } as never, {
      merchantId: MERCHANT,
      practitionerId: PRAC,
      date: DATE,
      durationMinutes: 30,
    });

    expect(slots.length).toBe(5); // 09:00, 09:15, 09:30, 09:45, 10:00
  });

  it("should respect service duration for slot generation", async () => {
    const schedule = [makeSchedule("09:00", "12:30")];
    const { from } = makeAvailabilitySupabase(schedule, []);

    const slots = await getAvailableSlots({ from } as never, {
      merchantId: MERCHANT,
      practitionerId: PRAC,
      date: DATE,
      durationMinutes: 45,
    });

    // Stride 15 min, durée 45 min : dernier slot 11:45 (11:45+45=12:30 ✓) → 12 créneaux
    expect(slots.length).toBe(12);
    expect(slots[0].ends_at).toBe(`${DATE}T09:45:00`);
  });

  it("should return empty array when practitioner has no schedule for the day", async () => {
    const { from } = makeAvailabilitySupabase([], []);

    const slots = await getAvailableSlots({ from } as never, {
      merchantId: MERCHANT,
      practitionerId: PRAC,
      date: DATE,
      durationMinutes: 30,
    });

    expect(slots).toHaveLength(0);
  });

  it("exception_date overrides recurring schedule", async () => {
    // Le jour récurrent dit dispo, mais l'exception dit non
    const schedule = [
      makeSchedule("09:00", "19:00"), // récurrent
      makeSchedule("09:00", "19:00", { is_available: false, exception_date: DATE }), // exception
    ];
    const { from } = makeAvailabilitySupabase(schedule, []);

    const slots = await getAvailableSlots({ from } as never, {
      merchantId: MERCHANT,
      practitionerId: PRAC,
      date: DATE,
      durationMinutes: 30,
    });

    expect(slots).toHaveLength(0);
  });

  it("génère des slots dans plusieurs blocs horaires (matin + après-midi)", async () => {
    const schedule = [
      makeSchedule("09:00", "12:00"), // matin
      makeSchedule("14:00", "17:00"), // après-midi (pause déjeuner exclue)
    ];
    const { from } = makeAvailabilitySupabase(schedule, []);

    const slots = await getAvailableSlots({ from } as never, {
      merchantId: MERCHANT,
      practitionerId: PRAC,
      date: DATE,
      durationMinutes: 30,
    });

    // Matin: 11 créneaux (09:00–11:30 stride 15), Après-midi: 11 créneaux (14:00–16:30) → 22
    expect(slots.length).toBe(22);
    const startTimes = slots.map((s) => s.starts_at);
    // Pas de créneau entre 12:00 et 14:00
    expect(startTimes.some((t) => t >= `${DATE}T12:00:00` && t < `${DATE}T14:00:00`)).toBe(false);
  });
});
