// @vitest-environment jsdom
/**
 * Tests: TipsSummary — calculs totaux/moyenne, top clients, état vide
 * Note: Recharts ne rend pas en jsdom — on teste le texte autour.
 */
import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { createElement } from "react";

afterEach(cleanup);

// Mock recharts — ResponsiveContainer ne fonctionne pas en jsdom
vi.mock("recharts", () => ({
  BarChart: ({ children }: { children: React.ReactNode }) => createElement("div", null, children),
  Bar: () => null,
  XAxis: () => null,
  YAxis: () => null,
  CartesianGrid: () => null,
  Tooltip: () => null,
  Cell: () => null,
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => createElement("div", null, children),
}));

import { vi } from "vitest";
const { default: TipsSummary } = await import("@/components/stats/tips-summary");

const mockTips = [
  { practitioner_id: "p1", name: "Marie", color: "#4F46E5", total_cents: 3000, count: 6 },
  { practitioner_id: "p2", name: "Pierre", color: "#0EA5E9", total_cents: 2000, count: 4 },
];

const mockTopClients = [
  { client_id: "c1", name: "Jean Petit", total_cents: 1500 },
  { client_id: "c2", name: "Sophie Bernard", total_cents: 1000 },
  { client_id: "c3", name: null, total_cents: 500 },
];

// ---- Tests -----------------------------------------------------------------

describe("TipsSummary — totaux et moyenne", () => {
  it("affiche le total des pourboires formaté en euros", () => {
    render(createElement(TipsSummary, { tips: mockTips, topClients: [] }));
    // 3000 + 2000 = 5000 cents = 50 € (formatEuros: maximumFractionDigits=0)
    expect(screen.getByText((_, el) => el?.textContent?.replace(/\s/g, " ") === "50 €" && el?.tagName === "P")).toBeInTheDocument();
  });

  it("affiche le nombre total de pourboires", () => {
    render(createElement(TipsSummary, { tips: mockTips, topClients: [] }));
    expect(screen.getByText("10 pourboires")).toBeInTheDocument();
  });

  it("affiche la moyenne par pourboire", () => {
    render(createElement(TipsSummary, { tips: mockTips, topClients: [] }));
    // 5000 / 10 = 500 cents = 5 €
    expect(screen.getByText((_, el) => el?.textContent?.replace(/\s/g, " ") === "5 €" && el?.tagName === "P")).toBeInTheDocument();
  });
});

describe("TipsSummary — top clients", () => {
  it("affiche les noms des top clients", () => {
    render(createElement(TipsSummary, { tips: mockTips, topClients: mockTopClients }));
    expect(screen.getByText("Jean Petit")).toBeInTheDocument();
    expect(screen.getByText("Sophie Bernard")).toBeInTheDocument();
  });

  it("affiche Client anonyme si nom null", () => {
    render(createElement(TipsSummary, { tips: mockTips, topClients: mockTopClients }));
    expect(screen.getByText("Client anonyme")).toBeInTheDocument();
  });

  it("affiche les montants des top clients", () => {
    render(createElement(TipsSummary, { tips: mockTips, topClients: mockTopClients }));
    // formatEuros: maximumFractionDigits=0, non-breaking space possible
    expect(screen.getByText((_, el) => el?.textContent?.replace(/\s/g, " ") === "15 €" && el?.tagName === "SPAN")).toBeInTheDocument();
    expect(screen.getByText((_, el) => el?.textContent?.replace(/\s/g, " ") === "10 €" && el?.tagName === "SPAN")).toBeInTheDocument();
  });

  it("affiche les numéros 1, 2, 3", () => {
    render(createElement(TipsSummary, { tips: mockTips, topClients: mockTopClients }));
    expect(screen.getByText("1")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
  });
});

describe("TipsSummary — état vide", () => {
  it("affiche Aucun pourboire si tips vide", () => {
    render(createElement(TipsSummary, { tips: [], topClients: [] }));
    expect(screen.getByText("Aucun pourboire pour cette période.")).toBeInTheDocument();
  });

  it("affiche 0 € pour total et moyenne quand vide", () => {
    render(createElement(TipsSummary, { tips: [], topClients: [] }));
    // formatEuros(0) = "0 €" (avec possible non-breaking space)
    const zeros = screen.getAllByText((_, el) => el?.textContent?.replace(/\s/g, " ") === "0 €" && el?.tagName === "P");
    expect(zeros.length).toBe(2); // total + moyenne
  });
});
