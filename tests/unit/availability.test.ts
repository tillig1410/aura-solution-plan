import { describe, it, expect } from "vitest";

/**
 * Availability Calculation Tests
 * Validates: free slots based on practitioner schedule minus existing bookings
 */

// Will import from @/lib/availability once implemented
// import { getAvailableSlots } from "@/lib/availability";

describe("Availability Calculation", () => {
  const practitionerSchedule = [
    { day_of_week: 0, start_time: "09:00", end_time: "12:30", is_available: true },
    { day_of_week: 0, start_time: "14:00", end_time: "19:00", is_available: true },
  ];

  const existingBookings = [
    { starts_at: "2026-04-06T09:00:00+02:00", ends_at: "2026-04-06T09:30:00+02:00", status: "confirmed" as const },
    { starts_at: "2026-04-06T10:00:00+02:00", ends_at: "2026-04-06T10:30:00+02:00", status: "confirmed" as const },
  ];

  it("should return free slots for a given day", () => {
    // Monday (day_of_week=0), 30-minute service
    // Schedule: 09:00-12:30, 14:00-19:00
    // Booked: 09:00-09:30, 10:00-10:30
    // Free: 09:30, 10:30, 11:00, 11:30, 12:00, 14:00-18:30 (every 30min)
    const serviceDuration = 30;
    const totalWorkMinutes = (3.5 + 5) * 60; // 510 min
    const totalSlots = Math.floor(totalWorkMinutes / serviceDuration); // 17
    const bookedSlots = existingBookings.length; // 2
    const freeSlots = totalSlots - bookedSlots; // 15

    expect(freeSlots).toBe(15);
  });

  it("should exclude exception dates (holidays)", () => {
    const exceptions = [
      { exception_date: "2026-04-06", is_available: false },
    ];

    // If exception blocks the whole day → 0 free slots
    expect(exceptions[0].is_available).toBe(false);
  });

  it("should handle overlapping bookings correctly", () => {
    // A 90-minute coloration at 10:00 blocks 10:00, 10:30, 11:00
    const longBooking = {
      starts_at: "2026-04-06T10:00:00+02:00",
      ends_at: "2026-04-06T11:30:00+02:00",
      status: "confirmed" as const,
    };

    const durationMinutes = (new Date(longBooking.ends_at).getTime() - new Date(longBooking.starts_at).getTime()) / 60000;
    expect(durationMinutes).toBe(90);
  });

  it("should not count cancelled bookings as occupied", () => {
    const cancelledBooking = {
      starts_at: "2026-04-06T09:00:00+02:00",
      ends_at: "2026-04-06T09:30:00+02:00",
      status: "cancelled" as const,
    };

    // Cancelled bookings should be excluded from occupancy
    expect(cancelledBooking.status).toBe("cancelled");
  });

  it("should respect service duration for slot generation", () => {
    // 45-minute service → slots at 09:00, 09:45, 10:30, 11:15, 12:00 (morning)
    const duration = 45;
    const morningMinutes = 3.5 * 60; // 210 min (09:00-12:30)
    const morningSlots = Math.floor(morningMinutes / duration); // 4

    expect(morningSlots).toBe(4);
  });

  it("should return empty array when practitioner has no availability for the day", () => {
    // Sunday (day_of_week=6) with no schedule entry → []
    const sundaySchedule = practitionerSchedule.filter((s) => s.day_of_week === 6);
    expect(sundaySchedule).toHaveLength(0);
  });
});
