// @vitest-environment jsdom
/**
 * Tests: BookingsChart — filtrage heures d'ouverture, rendu
 * Note: Recharts ne rend pas le SVG en jsdom — on teste la logique de filtrage.
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, cleanup } from "@testing-library/react";
import { createElement } from "react";

afterEach(cleanup);

// Capture les données passées à BarChart pour vérifier le filtrage
let capturedData: unknown[] = [];
vi.mock("recharts", () => ({
  BarChart: ({ data, children }: { data: unknown[]; children: React.ReactNode }) => {
    capturedData = data;
    return createElement("div", { "data-testid": "barchart" }, children);
  },
  Bar: () => null,
  XAxis: () => null,
  YAxis: () => null,
  CartesianGrid: () => null,
  Tooltip: () => null,
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => createElement("div", null, children),
}));

const { default: BookingsChart } = await import("@/components/stats/bookings-chart");

// ---- Test data —  24 heures avec count croissant
const fullDayData = Array.from({ length: 24 }, (_, h) => ({ hour: h, count: h }));

// ---- Tests -----------------------------------------------------------------

describe("BookingsChart — filtrage heures", () => {
  it("ne garde que les heures entre 8h et 21h inclus", () => {
    render(createElement(BookingsChart, { data: fullDayData }));
    // 8, 9, 10, ..., 21 = 14 heures
    expect(capturedData.length).toBe(14);
  });

  it("exclut les heures avant 8h", () => {
    render(createElement(BookingsChart, { data: fullDayData }));
    const hours = capturedData.map((d) => (d as { hour: number }).hour);
    expect(hours).not.toContain(7);
    expect(hours).not.toContain(0);
  });

  it("exclut les heures après 21h", () => {
    render(createElement(BookingsChart, { data: fullDayData }));
    const hours = capturedData.map((d) => (d as { hour: number }).hour);
    expect(hours).not.toContain(22);
    expect(hours).not.toContain(23);
  });

  it("inclut 8h et 21h", () => {
    render(createElement(BookingsChart, { data: fullDayData }));
    const hours = capturedData.map((d) => (d as { hour: number }).hour);
    expect(hours).toContain(8);
    expect(hours).toContain(21);
  });

  it("formate les labels en Xh", () => {
    render(createElement(BookingsChart, { data: fullDayData }));
    const labels = capturedData.map((d) => (d as { label: string }).label);
    expect(labels[0]).toBe("8h");
    expect(labels[labels.length - 1]).toBe("21h");
  });
});

describe("BookingsChart — données vides", () => {
  it("rend le composant sans crash avec un tableau vide", () => {
    const { container } = render(createElement(BookingsChart, { data: [] }));
    expect(container.querySelector("[data-testid='barchart']")).not.toBeNull();
    expect(capturedData.length).toBe(0);
  });
});
