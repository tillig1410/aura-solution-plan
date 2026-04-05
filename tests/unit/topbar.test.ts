// @vitest-environment jsdom
/**
 * Tests: TopBar — bouton déconnexion, appel signOut
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { createElement } from "react";

afterEach(cleanup);

const mockPush = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));

const mockSignOut = vi.fn().mockResolvedValue({});
vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    auth: { signOut: mockSignOut },
  }),
}));

const { default: TopBar } = await import("@/components/layout/topbar");

describe("TopBar — rendu", () => {
  it("affiche le bouton Déconnexion", () => {
    render(createElement(TopBar));
    expect(screen.getByText("Déconnexion")).toBeInTheDocument();
  });
});

describe("TopBar — déconnexion", () => {
  it("appelle signOut et redirige vers /login au clic", async () => {
    render(createElement(TopBar));
    fireEvent.click(screen.getByText("Déconnexion"));

    // Attend que la promesse signOut se résolve
    await vi.waitFor(() => {
      expect(mockSignOut).toHaveBeenCalledOnce();
      expect(mockPush).toHaveBeenCalledWith("/login");
    });
  });
});
