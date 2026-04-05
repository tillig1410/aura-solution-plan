// @vitest-environment jsdom
/**
 * Tests: Sidebar — navigation, liens, état actif
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { createElement } from "react";

afterEach(cleanup);

// Mock next/navigation
let mockPathname = "/agenda";
vi.mock("next/navigation", () => ({
  usePathname: () => mockPathname,
}));

// Mock next/link — rend un <a> simple
vi.mock("next/link", () => ({
  __esModule: true,
  default: ({ href, children, className }: { href: string; children: React.ReactNode; className?: string }) =>
    createElement("a", { href, className }, children),
}));

const { default: Sidebar } = await import("@/components/layout/sidebar");

// ---- Tests -----------------------------------------------------------------

describe("Sidebar — liens de navigation", () => {
  it("affiche tous les items de navigation", () => {
    render(createElement(Sidebar));
    expect(screen.getByText("Agenda")).toBeInTheDocument();
    expect(screen.getByText("Clients")).toBeInTheDocument();
    expect(screen.getByText("Messages")).toBeInTheDocument();
    expect(screen.getByText("Services")).toBeInTheDocument();
    expect(screen.getByText("Statistiques")).toBeInTheDocument();
    expect(screen.getByText("Paramètres")).toBeInTheDocument();
  });

  it("affiche le logo Plan", () => {
    render(createElement(Sidebar));
    expect(screen.getByText("Plan")).toBeInTheDocument();
  });

  it("chaque item a le bon href", () => {
    render(createElement(Sidebar));
    expect(screen.getByText("Agenda").closest("a")?.getAttribute("href")).toBe("/agenda");
    expect(screen.getByText("Clients").closest("a")?.getAttribute("href")).toBe("/clients");
    expect(screen.getByText("Messages").closest("a")?.getAttribute("href")).toBe("/messages");
    expect(screen.getByText("Services").closest("a")?.getAttribute("href")).toBe("/services");
    expect(screen.getByText("Statistiques").closest("a")?.getAttribute("href")).toBe("/stats");
    expect(screen.getByText("Paramètres").closest("a")?.getAttribute("href")).toBe("/settings");
  });
});

describe("Sidebar — état actif", () => {
  it("l'item actif a la classe bg-gray-100", () => {
    mockPathname = "/agenda";
    render(createElement(Sidebar));
    const agendaLink = screen.getByText("Agenda").closest("a");
    expect(agendaLink?.className).toContain("bg-gray-100");
  });

  it("les items inactifs n'ont pas bg-gray-100", () => {
    mockPathname = "/agenda";
    render(createElement(Sidebar));
    const clientsLink = screen.getByText("Clients").closest("a");
    expect(clientsLink?.className).not.toContain("bg-gray-100");
  });

  it("met en actif l'item correspondant au pathname", () => {
    mockPathname = "/clients";
    render(createElement(Sidebar));
    const clientsLink = screen.getByText("Clients").closest("a");
    expect(clientsLink?.className).toContain("bg-gray-100");

    const agendaLink = screen.getByText("Agenda").closest("a");
    expect(agendaLink?.className).not.toContain("bg-gray-100");
  });

  it("reconnaît les sous-routes (pathname = /settings/loyalty → Paramètres actif)", () => {
    mockPathname = "/settings/loyalty";
    render(createElement(Sidebar));
    const settingsLink = screen.getByText("Paramètres").closest("a");
    expect(settingsLink?.className).toContain("bg-gray-100");
  });
});
