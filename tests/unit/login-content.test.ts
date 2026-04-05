// @vitest-environment jsdom
/**
 * Tests: LoginContent — formulaire email OTP, écran de confirmation
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { createElement } from "react";

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const mockSignInWithOtp = vi.fn().mockResolvedValue({ error: null });
vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    auth: { signInWithOtp: mockSignInWithOtp },
  }),
}));

const { default: LoginContent } = await import("@/components/auth/login-content");

describe("LoginContent — formulaire", () => {
  it("affiche le titre Plan", () => {
    render(createElement(LoginContent));
    expect(screen.getByText("Plan")).toBeInTheDocument();
  });

  it("affiche le champ email", () => {
    render(createElement(LoginContent));
    expect(screen.getByPlaceholderText("votre@email.com")).toBeInTheDocument();
  });

  it("affiche le bouton de soumission", () => {
    render(createElement(LoginContent));
    expect(screen.getByText("Recevoir le lien de connexion")).toBeInTheDocument();
  });

  it("affiche la description", () => {
    render(createElement(LoginContent));
    expect(screen.getByText("Connectez-vous avec votre email professionnel")).toBeInTheDocument();
  });
});

describe("LoginContent — soumission OTP", () => {
  it("appelle signInWithOtp avec l'email et affiche la confirmation", async () => {
    render(createElement(LoginContent));

    const input = screen.getByPlaceholderText("votre@email.com");
    fireEvent.change(input, { target: { value: "test@salon.fr" } });
    fireEvent.submit(screen.getByText("Recevoir le lien de connexion").closest("form")!);

    await vi.waitFor(() => {
      expect(mockSignInWithOtp).toHaveBeenCalledWith(
        expect.objectContaining({ email: "test@salon.fr" }),
      );
    });

    await vi.waitFor(() => {
      expect(screen.getByText("Vérifiez votre email")).toBeInTheDocument();
      expect(screen.getByText("test@salon.fr")).toBeInTheDocument();
    });
  });

  it("n'affiche pas la confirmation si signInWithOtp retourne une erreur", async () => {
    mockSignInWithOtp.mockReset().mockResolvedValue({ error: { message: "Error" } });

    render(createElement(LoginContent));

    const input = screen.getByPlaceholderText("votre@email.com");
    fireEvent.change(input, { target: { value: "bad@test.fr" } });
    fireEvent.submit(screen.getByText("Recevoir le lien de connexion").closest("form")!);

    // Attend que le mock soit appelé ET que loading repasse à false
    await vi.waitFor(() => {
      expect(mockSignInWithOtp).toHaveBeenCalled();
      // Le bouton revient à son texte normal après setLoading(false)
      expect(screen.getByText("Recevoir le lien de connexion")).toBeInTheDocument();
    });

    // Doit rester sur le formulaire, pas la confirmation
    expect(screen.queryByText("Vérifiez votre email")).not.toBeInTheDocument();
  });
});
