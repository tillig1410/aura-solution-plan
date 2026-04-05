/**
 * T039 — Unit tests: DayView component
 * Rend le vrai composant avec React Testing Library et vérifie le DOM.
 */

// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";

afterEach(cleanup);
import { createElement } from "react";

// Mocks nécessaires pour les composants Next.js côté client (useRef, useEffect)
// ResizeObserver n'est pas disponible en jsdom
global.ResizeObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}));

// Supprime les warnings scrollTop (jsdom ne simule pas le scroll)
Object.defineProperty(HTMLElement.prototype, "scrollTop", {
  set: vi.fn(),
  get: vi.fn().mockReturnValue(0),
});

// Import après les globals
const { default: DayView } = await import("@/components/agenda/day-view");

// ---- Données de test -------------------------------------------------------

const practitioners = [
  { id: "prac-1", name: "Marie Dupont", color: "#4F46E5", is_active: true,
    merchant_id: "m1", email: null, specialties: [], sort_order: 0,
    created_at: "2026-01-01T00:00:00Z", updated_at: "2026-01-01T00:00:00Z" },
  { id: "prac-2", name: "Pierre Martin", color: "#0EA5E9", is_active: true,
    merchant_id: "m1", email: null, specialties: [], sort_order: 1,
    created_at: "2026-01-01T00:00:00Z", updated_at: "2026-01-01T00:00:00Z" },
];

const inactivePractitioner = {
  ...practitioners[0],
  id: "prac-3",
  name: "Inactif Dupont",
  is_active: false,
};

// Date de test : mercredi 1 avril 2026
const testDate = new Date("2026-04-01T12:00:00+02:00");

function makeBooking(overrides: Record<string, unknown> = {}) {
  return {
    id: "b-1",
    merchant_id: "m1",
    client_id: "c-1",
    practitioner_id: "prac-1",
    service_id: "s-1",
    starts_at: "2026-04-01T09:00:00+02:00",
    ends_at: "2026-04-01T09:30:00+02:00",
    status: "confirmed" as const,
    source_channel: "whatsapp" as const,
    version: 1,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    cancelled_at: null,
    cancelled_by: null,
    cancellation_reason: null,
    notes: null,
    client: { id: "c-1", name: "Jean Petit", phone: "+33600000001", preferred_language: "fr" },
    practitioner: { id: "prac-1", name: "Marie Dupont", color: "#4F46E5" },
    service: { id: "s-1", name: "Coupe homme", duration_minutes: 30, price_cents: 2500 },
    ...overrides,
  };
}

const bookings = [
  makeBooking({ id: "b-1", practitioner_id: "prac-1", starts_at: "2026-04-01T09:00:00+02:00", ends_at: "2026-04-01T09:30:00+02:00" }),
  makeBooking({ id: "b-2", practitioner_id: "prac-2", starts_at: "2026-04-01T10:00:00+02:00", ends_at: "2026-04-01T11:00:00+02:00", client: { id: "c-2", name: "Sophie Bernard", phone: null, preferred_language: "fr" }, service: { id: "s-2", name: "Coloration", duration_minutes: 60, price_cents: 7000 } }),
  makeBooking({ id: "b-3", practitioner_id: "prac-1", starts_at: "2026-04-01T14:00:00+02:00", ends_at: "2026-04-01T14:30:00+02:00", client: { id: "c-3", name: "Paul Durand", phone: null, preferred_language: "fr" } }),
];

// ---- Tests -----------------------------------------------------------------

describe("DayView — affichage des en-têtes de praticiens", () => {
  it("affiche le nom de chaque praticien actif dans l'en-tête", () => {
    render(createElement(DayView, {
      bookings: [],
      practitioners,
      date: testDate,
      onBookingClick: vi.fn(),
    }));

    expect(screen.getByText("Marie Dupont")).toBeInTheDocument();
    expect(screen.getByText("Pierre Martin")).toBeInTheDocument();
  });

  it("n'affiche pas les praticiens inactifs", () => {
    render(createElement(DayView, {
      bookings: [],
      practitioners: [...practitioners, inactivePractitioner],
      date: testDate,
      onBookingClick: vi.fn(),
    }));

    expect(screen.queryByText("Inactif Dupont")).not.toBeInTheDocument();
  });

  it("affiche une colonne par praticien actif", () => {
    const { container } = render(createElement(DayView, {
      bookings: [],
      practitioners,
      date: testDate,
      onBookingClick: vi.fn(),
    }));

    // L'en-tête contient autant de cells de praticiens que de praticiens actifs
    const header = container.querySelector(".sticky");
    const cells = header?.querySelectorAll(".flex-1");
    expect(cells?.length).toBe(2);
  });
});

describe("DayView — rendu des bookings", () => {
  it("affiche le nom du client sur chaque carte de booking", () => {
    render(createElement(DayView, {
      bookings,
      practitioners,
      date: testDate,
      onBookingClick: vi.fn(),
    }));

    expect(screen.getByText("Jean Petit")).toBeInTheDocument();
    expect(screen.getByText("Sophie Bernard")).toBeInTheDocument();
    expect(screen.getByText("Paul Durand")).toBeInTheDocument();
  });

  it("affiche le nom du service sur les bookings suffisamment hauts (≥36px)", () => {
    // b-2 dure 60 min → height=60px → doit afficher le service
    render(createElement(DayView, {
      bookings: [makeBooking({ id: "b-2", starts_at: "2026-04-01T10:00:00+02:00", ends_at: "2026-04-01T11:00:00+02:00", service: { id: "s-2", name: "Coloration", duration_minutes: 60, price_cents: 7000 } })],
      practitioners,
      date: testDate,
      onBookingClick: vi.fn(),
    }));

    expect(screen.getByText("Coloration")).toBeInTheDocument();
  });

  it("n'affiche pas les bookings d'une autre journée", () => {
    const otherDayBooking = makeBooking({
      id: "b-other",
      starts_at: "2026-04-02T09:00:00+02:00",
      ends_at: "2026-04-02T09:30:00+02:00",
      client: { id: "c-other", name: "Autre Jour", phone: null, preferred_language: "fr" },
    });

    render(createElement(DayView, {
      bookings: [otherDayBooking],
      practitioners,
      date: testDate, // 1 avril
      onBookingClick: vi.fn(),
    }));

    expect(screen.queryByText("Autre Jour")).not.toBeInTheDocument();
  });

  it("n'affiche pas de noms quand il n'y a aucun booking", () => {
    render(createElement(DayView, {
      bookings: [],
      practitioners,
      date: testDate,
      onBookingClick: vi.fn(),
    }));

    // Aucune carte de booking ne doit être visible
    expect(screen.queryByText("Jean Petit")).not.toBeInTheDocument();
  });
});

describe("DayView — interactions", () => {
  it("appelle onBookingClick avec le bon booking au clic", () => {
    const onBookingClick = vi.fn();

    render(createElement(DayView, {
      bookings: [makeBooking()],
      practitioners,
      date: testDate,
      onBookingClick,
    }));

    fireEvent.click(screen.getByText("Jean Petit"));
    expect(onBookingClick).toHaveBeenCalledOnce();
    expect(onBookingClick).toHaveBeenCalledWith(
      expect.objectContaining({ id: "b-1" }),
    );
  });
});

describe("DayView — grille horaire", () => {
  it("affiche la plage horaire 8h–19h dans le gutter gauche", () => {
    render(createElement(DayView, {
      bookings: [],
      practitioners,
      date: testDate,
      onBookingClick: vi.fn(),
    }));

    expect(screen.getByText("8:00")).toBeInTheDocument();
    expect(screen.getByText("19:00")).toBeInTheDocument();
  });

  it("affiche la pause déjeuner dans chaque colonne praticien", () => {
    render(createElement(DayView, {
      bookings: [],
      practitioners,
      date: testDate,
      onBookingClick: vi.fn(),
    }));

    const pauses = screen.getAllByText("Pause déjeuner");
    expect(pauses.length).toBe(practitioners.length);
  });
});

describe("DayView — positionnement CSS des bookings", () => {
  it("calcule le top à 60px pour un booking à 9h (day_start=8h, 1px/min)", () => {
    const { container } = render(createElement(DayView, {
      bookings: [makeBooking({ starts_at: "2026-04-01T09:00:00+02:00", ends_at: "2026-04-01T09:30:00+02:00" })],
      practitioners,
      date: testDate,
      onBookingClick: vi.fn(),
    }));

    const bookingEl = container.querySelector("button[style*='top']") as HTMLElement | null;
    expect(bookingEl).not.toBeNull();
    // top = (9h - 8h) × 60min × 1px/min = 60px
    expect(bookingEl?.style.top).toBe("60px");
  });

  it("calcule la hauteur à 30px pour un booking de 30 minutes (1px/min)", () => {
    const { container } = render(createElement(DayView, {
      bookings: [makeBooking({ starts_at: "2026-04-01T09:00:00+02:00", ends_at: "2026-04-01T09:30:00+02:00" })],
      practitioners,
      date: testDate,
      onBookingClick: vi.fn(),
    }));

    const bookingEl = container.querySelector("button[style*='height']") as HTMLElement | null;
    expect(bookingEl).not.toBeNull();
    expect(bookingEl?.style.height).toBe("30px");
  });
});
