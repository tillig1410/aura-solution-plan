// @vitest-environment jsdom
/**
 * Tests: PractitionerPerformance — tableau de performance praticiens
 */
import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { createElement } from "react";

afterEach(cleanup);

const { default: PractitionerPerformance } = await import("@/components/stats/practitioner-performance");

// ---- Test data -------------------------------------------------------------

const mockPractitioners = [
  { id: "p1", name: "Marie Dupont", color: "#4F46E5", bookings_count: 25, revenue_cents: 50000, fill_rate: 92, tips_cents: 3500, top_service: "Coupe homme" },
  { id: "p2", name: "Pierre Martin", color: "#0EA5E9", bookings_count: 18, revenue_cents: 35000, fill_rate: 85, tips_cents: 2000, top_service: "Coloration" },
];

// ---- Tests -----------------------------------------------------------------

describe("PractitionerPerformance — état vide", () => {
  it("affiche un message si aucun praticien", () => {
    render(createElement(PractitionerPerformance, { practitioners: [] }));
    expect(screen.getByText("Aucune donnée pour cette période.")).toBeInTheDocument();
  });
});

describe("PractitionerPerformance — affichage tableau", () => {
  it("affiche les en-têtes du tableau", () => {
    render(createElement(PractitionerPerformance, { practitioners: mockPractitioners }));
    expect(screen.getByText("Praticien")).toBeInTheDocument();
    expect(screen.getByText("RDV")).toBeInTheDocument();
    expect(screen.getByText("CA")).toBeInTheDocument();
    expect(screen.getByText("Taux")).toBeInTheDocument();
  });

  it("affiche le nom de chaque praticien", () => {
    render(createElement(PractitionerPerformance, { practitioners: mockPractitioners }));
    expect(screen.getByText("Marie Dupont")).toBeInTheDocument();
    expect(screen.getByText("Pierre Martin")).toBeInTheDocument();
  });

  it("affiche le nombre de bookings", () => {
    render(createElement(PractitionerPerformance, { practitioners: mockPractitioners }));
    expect(screen.getByText("25")).toBeInTheDocument();
    expect(screen.getByText("18")).toBeInTheDocument();
  });

  it("affiche le fill_rate avec %", () => {
    render(createElement(PractitionerPerformance, { practitioners: mockPractitioners }));
    expect(screen.getByText("92%")).toBeInTheDocument();
    expect(screen.getByText("85%")).toBeInTheDocument();
  });

  it("affiche le top service", () => {
    render(createElement(PractitionerPerformance, { practitioners: mockPractitioners }));
    expect(screen.getByText("Coupe homme")).toBeInTheDocument();
    expect(screen.getByText("Coloration")).toBeInTheDocument();
  });
});

describe("PractitionerPerformance — un seul praticien", () => {
  it("fonctionne avec un seul praticien (pas de crash sur Math.max vide)", () => {
    render(createElement(PractitionerPerformance, {
      practitioners: [mockPractitioners[0]],
    }));
    expect(screen.getByText("Marie Dupont")).toBeInTheDocument();
  });
});
