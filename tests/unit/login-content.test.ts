// @vitest-environment jsdom
/**
 * Tests: LoginContent — formulaire email/password, soumission login
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { createElement } from "react";

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const mockPush = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush, replace: vi.fn(), prefetch: vi.fn(), back: vi.fn(), forward: vi.fn(), refresh: vi.fn() }),
}));

const mockSignInWithPassword = vi.fn().mockResolvedValue({ error: null });
vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    auth: { signInWithPassword: mockSignInWithPassword },
  }),
}));

const { default: LoginContent } = await import("@/components/auth/login-content");

describe("LoginContent — formulaire", () => {
  it("affiche le champ email placeholder", () => {
    render(createElement(LoginContent));
    expect(screen.getByPlaceholderText("votre@email.com")).toBeInTheDocument();
  });

  it("affiche le bouton de soumission", () => {
    render(createElement(LoginContent));
    expect(screen.getByText("Se connecter")).toBeInTheDocument();
  });

  it("affiche la description", () => {
    render(createElement(LoginContent));
    expect(screen.getByText("Connectez-vous à votre espace")).toBeInTheDocument();
  });
});

describe("LoginContent — soumission password", () => {
  it("appelle signInWithPassword avec l'email et redirige", async () => {
    render(createElement(LoginContent));

    const emailInput = screen.getByPlaceholderText("votre@email.com");
    fireEvent.change(emailInput, { target: { value: "test@salon.fr" } });

    const passwordInput = screen.getByPlaceholderText("Mot de passe");
    fireEvent.change(passwordInput, { target: { value: "secret123" } });

    fireEvent.submit(screen.getByText("Se connecter").closest("form")!);

    await vi.waitFor(() => {
      expect(mockSignInWithPassword).toHaveBeenCalledWith(
        expect.objectContaining({ email: "test@salon.fr", password: "secret123" }),
      );
    });

    await vi.waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith("/agenda");
    });
  });

  it("affiche une erreur si signInWithPassword échoue", async () => {
    mockSignInWithPassword.mockReset().mockResolvedValue({
      error: { message: "Invalid login credentials" },
    });

    render(createElement(LoginContent));

    const emailInput = screen.getByPlaceholderText("votre@email.com");
    fireEvent.change(emailInput, { target: { value: "bad@test.fr" } });

    const passwordInput = screen.getByPlaceholderText("Mot de passe");
    fireEvent.change(passwordInput, { target: { value: "wrong" } });

    fireEvent.submit(screen.getByText("Se connecter").closest("form")!);

    await vi.waitFor(() => {
      expect(mockSignInWithPassword).toHaveBeenCalled();
    });

    await vi.waitFor(() => {
      expect(screen.getByText("Email ou mot de passe incorrect.")).toBeInTheDocument();
    });
  });
});
