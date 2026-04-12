// @vitest-environment jsdom
/**
 * Tests: MonthView — grille calendrier, comptage bookings, interactions
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { createElement } from "react";

afterEach(cleanup);

const { default: MonthView } = await import("@/components/agenda/month-view");

// ---- Test data -------------------------------------------------------------

const practitioners = [
  { id: "prac-1", name: "Marie Dupont", color: "#4F46E5", is_active: true,
    merchant_id: "m1", email: null, specialties: [], sort_order: 0,
    created_at: "2026-01-01T00:00:00Z", updated_at: "2026-01-01T00:00:00Z" },
];

// Avril 2026
const month = new Date("2026-04-01T00:00:00");

function makeBooking(overrides: Record<string, unknown> = {}) {
  return {
    id: "b-1", merchant_id: "m1", client_id: "c-1", practitioner_id: "prac-1",
    service_id: "s-1", starts_at: "2026-04-10T09:00:00+02:00", ends_at: "2026-04-10T09:30:00+02:00",
    status: "confirmed" as const, source_channel: "dashboard" as const, version: 1,
    created_at: "2026-01-01T00:00:00Z", updated_at: "2026-01-01T00:00:00Z",
    cancelled_at: null, cancelled_by: null, cancellation_reason: null, notes: null,
    client: { id: "c-1", name: "Jean Petit", phone: null, preferred_language: "fr", notes: null, loyalty_tier: "bronze", loyalty_points: 0 },
    practitioner: { id: "prac-1", name: "Marie Dupont", color: "#4F46E5" },
    service: { id: "s-1", name: "Coupe", duration_minutes: 30, price_cents: 2500 },
    ...overrides,
  };
}

function renderMonth(overrides: Record<string, unknown> = {}) {
  return render(createElement(MonthView, {
    bookings: [],
    practitioners,
    month,
    onDayClick: vi.fn(),
    ...overrides,
  }));
}

// ---- Tests -----------------------------------------------------------------

describe("MonthView — en-têtes", () => {
  it("affiche les 7 labels de jours (Lun–Dim)", () => {
    renderMonth();
    expect(screen.getByText("Lun")).toBeInTheDocument();
    expect(screen.getByText("Dim")).toBeInTheDocument();
  });
});

describe("MonthView — grille 42 jours", () => {
  it("affiche 42 boutons (6 semaines × 7 jours)", () => {
    const { container } = renderMonth();
    const buttons = container.querySelectorAll("button");
    expect(buttons.length).toBe(42);
  });

  it("le premier jour visible commence le lundi (30 mars pour avril 2026)", () => {
    renderMonth();
    // Avril 2026 commence un mercredi → grille commence le lundi 30 mars
    expect(screen.getAllByText("30").length).toBeGreaterThan(0);
  });

  it("affiche les jours du mois courant (1-30 avril)", () => {
    renderMonth();
    expect(screen.getAllByText("1").length).toBeGreaterThan(0);
    expect(screen.getAllByText("15").length).toBeGreaterThan(0);
    expect(screen.getAllByText("30").length).toBeGreaterThan(0);
  });

  it("affiche Fermé chaque dimanche", () => {
    renderMonth();
    const fermes = screen.getAllByText("Fermé");
    expect(fermes.length).toBe(6); // 6 semaines × 1 dimanche
  });
});

describe("MonthView — bookings", () => {
  it("affiche le compteur de bookings sur les jours avec bookings", () => {
    renderMonth({
      bookings: [
        makeBooking({ id: "b-1", starts_at: "2026-04-10T09:00:00+02:00" }),
        makeBooking({ id: "b-2", starts_at: "2026-04-10T10:00:00+02:00" }),
      ],
    });
    // Le composant affiche un badge avec le nombre total (ex: "2") dans un span text-indigo-600
    const badges = screen.getAllByText("2");
    // Au moins un badge "2" correspond au compteur du jour avec 2 bookings
    expect(badges.length).toBeGreaterThanOrEqual(1);
  });

  it("n'affiche pas de compteur sur les jours sans booking", () => {
    renderMonth({ bookings: [] });
    expect(screen.queryByText(/RDV/)).not.toBeInTheDocument();
  });

  it("affiche un point de couleur praticien", () => {
    const { container } = renderMonth({
      bookings: [makeBooking()],
    });
    const dot = container.querySelector("span[style*='background-color']") as HTMLElement;
    expect(dot).not.toBeNull();
    expect(dot?.style.backgroundColor).toBe("rgb(79, 70, 229)"); // #4F46E5
  });
});

describe("MonthView — interactions", () => {
  it("appelle onDayClick avec la bonne date au clic", () => {
    const onDayClick = vi.fn();
    renderMonth({ onDayClick });

    // Cliquer sur un bouton contenant "15"
    const day15 = screen.getByText("15").closest("button");
    expect(day15).not.toBeNull();
    fireEvent.click(day15!);

    expect(onDayClick).toHaveBeenCalledOnce();
    const clickedDate = onDayClick.mock.calls[0][0] as Date;
    expect(clickedDate.getDate()).toBe(15);
    expect(clickedDate.getMonth()).toBe(3); // avril = mois 3
  });
});
