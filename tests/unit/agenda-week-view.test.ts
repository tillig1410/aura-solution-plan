// @vitest-environment jsdom
/**
 * Tests: WeekView — affichage semaine, filtrage praticiens, positionnement bookings
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { createElement } from "react";

afterEach(cleanup);

global.ResizeObserver = vi.fn().mockImplementation(function (this: Record<string, unknown>) {
  this.observe = vi.fn();
  this.unobserve = vi.fn();
  this.disconnect = vi.fn();
});
Object.defineProperty(HTMLElement.prototype, "scrollTop", {
  set: vi.fn(), get: vi.fn().mockReturnValue(0),
});

const { default: WeekView } = await import("@/components/agenda/week-view");

// ---- Test data -------------------------------------------------------------

const practitioners = [
  { id: "prac-1", name: "Marie Dupont", color: "#4F46E5", is_active: true,
    merchant_id: "m1", email: null, specialties: [], sort_order: 0,
    created_at: "2026-01-01T00:00:00Z", updated_at: "2026-01-01T00:00:00Z" },
  { id: "prac-2", name: "Pierre Martin", color: "#0EA5E9", is_active: true,
    merchant_id: "m1", email: null, specialties: [], sort_order: 1,
    created_at: "2026-01-01T00:00:00Z", updated_at: "2026-01-01T00:00:00Z" },
  { id: "prac-3", name: "Inactif Test", color: "#FF0000", is_active: false,
    merchant_id: "m1", email: null, specialties: [], sort_order: 2,
    created_at: "2026-01-01T00:00:00Z", updated_at: "2026-01-01T00:00:00Z" },
];

// Lundi 30 mars 2026
const weekStart = new Date("2026-03-30T00:00:00");

function makeBooking(overrides: Record<string, unknown> = {}) {
  return {
    id: "b-1", merchant_id: "m1", client_id: "c-1", practitioner_id: "prac-1",
    service_id: "s-1", starts_at: "2026-03-30T09:00:00+02:00", ends_at: "2026-03-30T09:30:00+02:00",
    status: "confirmed" as const, source_channel: "whatsapp" as const, version: 1,
    created_at: "2026-01-01T00:00:00Z", updated_at: "2026-01-01T00:00:00Z",
    cancelled_at: null, cancelled_by: null, cancellation_reason: null, notes: null,
    client: { id: "c-1", name: "Jean Petit", phone: "+33600000001", preferred_language: "fr", notes: null, loyalty_tier: "bronze", loyalty_points: 0 },
    practitioner: { id: "prac-1", name: "Marie Dupont", color: "#4F46E5" },
    service: { id: "s-1", name: "Coupe homme", duration_minutes: 30, price_cents: 2500 },
    ...overrides,
  };
}

function renderWeek(overrides: Record<string, unknown> = {}) {
  return render(createElement(WeekView, {
    bookings: [],
    practitioners,
    weekStart,
    selectedPractitionerIds: [],
    onBookingClick: vi.fn(),
    ...overrides,
  }));
}

// ---- Tests -----------------------------------------------------------------

describe("WeekView — en-têtes jours", () => {
  it("affiche les 7 labels de jours (Lun–Dim)", () => {
    renderWeek();
    expect(screen.getByText("Lun")).toBeInTheDocument();
    expect(screen.getByText("Mar")).toBeInTheDocument();
    expect(screen.getByText("Mer")).toBeInTheDocument();
    expect(screen.getByText("Jeu")).toBeInTheDocument();
    expect(screen.getByText("Ven")).toBeInTheDocument();
    expect(screen.getByText("Sam")).toBeInTheDocument();
    expect(screen.getByText("Dim")).toBeInTheDocument();
  });

  it("affiche les numéros de jour correctement (30 mars → 5 avril)", () => {
    renderWeek();
    expect(screen.getByText("30")).toBeInTheDocument(); // lundi
    expect(screen.getByText("5")).toBeInTheDocument();  // dimanche
  });
});

describe("WeekView — grille horaire", () => {
  it("affiche les heures de 8:00 à 19:00 dans le gutter", () => {
    renderWeek();
    expect(screen.getByText("8:00")).toBeInTheDocument();
    expect(screen.getByText("12:00")).toBeInTheDocument();
    expect(screen.getByText("19:00")).toBeInTheDocument();
  });

  it("affiche Fermé le dimanche", () => {
    renderWeek();
    expect(screen.getByText("Fermé")).toBeInTheDocument();
  });
});

describe("WeekView — bookings", () => {
  it("affiche le nom du client", () => {
    renderWeek({ bookings: [makeBooking()] });
    expect(screen.getByText("Jean Petit")).toBeInTheDocument();
  });

  it("n'affiche pas les bookings d'un autre praticien si filtré", () => {
    renderWeek({
      bookings: [makeBooking({ practitioner_id: "prac-2" })],
      selectedPractitionerIds: ["prac-1"], // seul prac-1 sélectionné
    });
    expect(screen.queryByText("Jean Petit")).not.toBeInTheDocument();
  });

  it("affiche les bookings de tous les praticiens si selectedPractitionerIds est vide", () => {
    renderWeek({
      bookings: [
        makeBooking({ id: "b-1", practitioner_id: "prac-1" }),
        makeBooking({ id: "b-2", practitioner_id: "prac-2", client: { id: "c-2", name: "Sophie", phone: null, preferred_language: "fr", notes: null, loyalty_tier: "bronze", loyalty_points: 0 } }),
      ],
      selectedPractitionerIds: [],
    });
    expect(screen.getByText("Jean Petit")).toBeInTheDocument();
    expect(screen.getByText("Sophie")).toBeInTheDocument();
  });

  it("positionne un booking à 9h avec le top calculé selon pxPerMinute", () => {
    const { container } = renderWeek({
      bookings: [makeBooking({ starts_at: "2026-03-30T09:00:00+02:00", ends_at: "2026-03-30T09:30:00+02:00" })],
    });
    // Le style top est sur le wrapper div (group/tip), pas sur le button
    // pxPerMinute = max(1.5, (0 - 24) / 660) = 1.5
    // top = 60 × 1.5 + 24 = 114px
    const wrapper = container.querySelector("div.group\\/tip") as HTMLElement | null;
    expect(wrapper).not.toBeNull();
    expect(wrapper?.style.top).toBe("114px");
  });

  it("calcule height selon la durée et pxPerMinute", () => {
    const { container } = renderWeek({
      bookings: [makeBooking({ starts_at: "2026-03-30T10:00:00+02:00", ends_at: "2026-03-30T11:00:00+02:00" })],
    });
    // height = max(60 × 1.5, 28) = 90px
    const wrapper = container.querySelector("div.group\\/tip") as HTMLElement | null;
    expect(wrapper).not.toBeNull();
    expect(wrapper?.style.height).toBe("90px");
  });

  it("appelle onBookingClick au clic", () => {
    const onClick = vi.fn();
    const { container } = renderWeek({ bookings: [makeBooking()], onBookingClick: onClick });
    // Le bouton clickable est à l'intérieur du bloc booking
    const bookingButton = container.querySelector("button.rounded-lg") as HTMLElement;
    expect(bookingButton).not.toBeNull();
    fireEvent.click(bookingButton!);
    expect(onClick).toHaveBeenCalledOnce();
    expect(onClick).toHaveBeenCalledWith(expect.objectContaining({ id: "b-1" }));
  });

  it("affiche le nom du service si booking >= 30px de haut", () => {
    renderWeek({
      bookings: [makeBooking({
        starts_at: "2026-03-30T10:00:00+02:00",
        ends_at: "2026-03-30T10:45:00+02:00",
        service: { id: "s-1", name: "Coloration", duration_minutes: 45, price_cents: 5000 },
      })],
    });
    // Le service apparaît dans la carte ET dans le tooltip
    const matches = screen.getAllByText("Coloration");
    expect(matches.length).toBeGreaterThanOrEqual(1);
  });
});

describe("WeekView — dimanche", () => {
  it("ne rend pas de booking le dimanche", () => {
    renderWeek({
      bookings: [makeBooking({
        id: "b-sunday",
        starts_at: "2026-04-05T10:00:00+02:00", // dimanche
        ends_at: "2026-04-05T10:30:00+02:00",
        client: { id: "c-sun", name: "Dimanche Client", phone: null, preferred_language: "fr", notes: null, loyalty_tier: "bronze", loyalty_points: 0 },
      })],
    });
    expect(screen.queryByText("Dimanche Client")).not.toBeInTheDocument();
  });
});
