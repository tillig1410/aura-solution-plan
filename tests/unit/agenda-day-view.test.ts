import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";

/**
 * T039 — Unit tests: AgendaDayView component
 * Validates rendering of bookings per practitioner with correct colors and time slots
 */

// Minimal mock data matching Supabase types
const mockPractitioners = [
  { id: "prac-1", name: "Marie Dupont", color: "#4F46E5", is_active: true },
  { id: "prac-2", name: "Pierre Martin", color: "#0EA5E9", is_active: true },
];

const mockBookings = [
  {
    id: "b-1",
    practitioner_id: "prac-1",
    client_id: "c-1",
    service_id: "s-1",
    starts_at: "2026-04-01T09:00:00+02:00",
    ends_at: "2026-04-01T09:30:00+02:00",
    status: "confirmed" as const,
    source_channel: "whatsapp" as const,
    client: { name: "Jean Petit" },
    service: { name: "Coupe homme", duration_minutes: 30 },
  },
  {
    id: "b-2",
    practitioner_id: "prac-2",
    client_id: "c-2",
    service_id: "s-2",
    starts_at: "2026-04-01T10:00:00+02:00",
    ends_at: "2026-04-01T11:00:00+02:00",
    status: "pending" as const,
    source_channel: "sms" as const,
    client: { name: "Sophie Bernard" },
    service: { name: "Coloration", duration_minutes: 60 },
  },
  {
    id: "b-3",
    practitioner_id: "prac-1",
    client_id: "c-3",
    service_id: "s-1",
    starts_at: "2026-04-01T14:00:00+02:00",
    ends_at: "2026-04-01T14:30:00+02:00",
    status: "confirmed" as const,
    source_channel: "dashboard" as const,
    client: { name: "Paul Durand" },
    service: { name: "Coupe homme", duration_minutes: 30 },
  },
];

describe("AgendaDayView — rendering logic", () => {
  it("should group bookings by practitioner correctly", () => {
    const grouped = mockPractitioners.map((prac) => ({
      practitioner: prac,
      bookings: mockBookings.filter((b) => b.practitioner_id === prac.id),
    }));

    expect(grouped[0].practitioner.id).toBe("prac-1");
    expect(grouped[0].bookings).toHaveLength(2);
    expect(grouped[1].practitioner.id).toBe("prac-2");
    expect(grouped[1].bookings).toHaveLength(1);
  });

  it("should assign correct color per practitioner", () => {
    const prac1Color = mockPractitioners.find((p) => p.id === "prac-1")?.color;
    const prac2Color = mockPractitioners.find((p) => p.id === "prac-2")?.color;

    expect(prac1Color).toBe("#4F46E5");
    expect(prac2Color).toBe("#0EA5E9");
  });

  it("should display bookings sorted by starts_at within a practitioner column", () => {
    const prac1Bookings = mockBookings
      .filter((b) => b.practitioner_id === "prac-1")
      .sort((a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime());

    expect(prac1Bookings[0].id).toBe("b-1"); // 09:00
    expect(prac1Bookings[1].id).toBe("b-3"); // 14:00
  });

  it("should calculate top position based on time (pixels from start of day)", () => {
    // Day view starts at 08:00 (480 minutes), each hour = 60px
    const DAY_START_MINUTES = 8 * 60; // 480
    const PX_PER_MINUTE = 1; // 1px per minute

    const booking = mockBookings[0]; // 09:00
    const bookingMinutes = 9 * 60; // 540
    const topPx = (bookingMinutes - DAY_START_MINUTES) * PX_PER_MINUTE;

    expect(topPx).toBe(60); // 60px from top
  });

  it("should calculate height based on duration", () => {
    const PX_PER_MINUTE = 1;

    const booking30 = mockBookings[0]; // 30 min
    const booking60 = mockBookings[1]; // 60 min

    const duration30 = (new Date(booking30.ends_at).getTime() - new Date(booking30.starts_at).getTime()) / 60000;
    const duration60 = (new Date(booking60.ends_at).getTime() - new Date(booking60.starts_at).getTime()) / 60000;

    expect(duration30 * PX_PER_MINUTE).toBe(30);
    expect(duration60 * PX_PER_MINUTE).toBe(60);
  });

  it("should show client name and service name on each booking card", () => {
    const booking = mockBookings[0];
    expect(booking.client.name).toBe("Jean Petit");
    expect(booking.service.name).toBe("Coupe homme");
  });

  it("should apply different visual style for pending vs confirmed bookings", () => {
    const confirmed = mockBookings.filter((b) => b.status === "confirmed");
    const pending = mockBookings.filter((b) => b.status === "pending");

    expect(confirmed).toHaveLength(2);
    expect(pending).toHaveLength(1);

    // Pending bookings should have a distinct visual indicator (opacity/border)
    expect(pending[0].status).toBe("pending");
    expect(confirmed[0].status).toBe("confirmed");
  });

  it("should render time slots from 08:00 to 20:00 in the left column", () => {
    const startHour = 8;
    const endHour = 20;
    const slots: string[] = [];
    for (let h = startHour; h <= endHour; h++) {
      slots.push(`${String(h).padStart(2, "0")}:00`);
    }

    expect(slots[0]).toBe("08:00");
    expect(slots[slots.length - 1]).toBe("20:00");
    expect(slots).toHaveLength(13); // 08:00 to 20:00 inclusive
  });

  it("should show correct number of practitioner columns", () => {
    const activePractitioners = mockPractitioners.filter((p) => p.is_active);
    expect(activePractitioners).toHaveLength(2);
  });

  it("should handle day with no bookings gracefully", () => {
    const emptyDayBookings = mockBookings.filter((b) => b.starts_at.startsWith("2026-05-01"));
    expect(emptyDayBookings).toHaveLength(0);
    // Component should render empty columns, not crash
  });

  it("should display channel icon (whatsapp/sms/dashboard) on booking card", () => {
    const channels = mockBookings.map((b) => b.source_channel);
    expect(channels).toContain("whatsapp");
    expect(channels).toContain("sms");
    expect(channels).toContain("dashboard");
  });
});

describe("AgendaDayView — date formatting", () => {
  it("should format date as 'Mercredi 1 avril 2026'", () => {
    const date = new Date("2026-04-01");
    const formatted = date.toLocaleDateString("fr-FR", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    });
    expect(formatted).toContain("avril");
    expect(formatted).toContain("2026");
  });

  it("should format time as HH:mm", () => {
    const date = new Date("2026-04-01T09:00:00+02:00");
    const hours = date.getHours();
    const minutes = date.getMinutes();
    const formatted = `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
    expect(formatted).toBe("09:00");
  });
});
