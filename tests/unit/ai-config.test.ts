// @vitest-environment jsdom
/**
 * Tests: AiConfig — formulaire configuration IA (ton, langues, canaux, répondeur)
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { createElement } from "react";

afterEach(cleanup);

// Mock sonner
vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

const { default: AiConfig } = await import("@/components/settings/ai-config");

const baseMerchant = {
  id: "m1", user_id: "u1", name: "Salon Test", slug: "salon-test",
  ai_name: "Sofia", ai_tone: "friendly", ai_languages: ["fr", "en"],
  voice_enabled: false, telnyx_phone_number: null,
  cancellation_delay_minutes: 120,
  // champs supplémentaires requis par le type
  email: "test@salon.fr", address: null, phone: null,
  opening_hours: null, stripe_account_id: null, stripe_subscription_id: null,
  stripe_customer_id: null, plan_tier: "base" as const,
  seats: 1, is_onboarded: true, created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
} as Parameters<typeof AiConfig>[0]["merchant"];

const mockSave = vi.fn().mockResolvedValue(undefined);

function renderAiConfig(overrides: Record<string, unknown> = {}) {
  return render(createElement(AiConfig, {
    merchant: { ...baseMerchant, ...overrides },
    onSave: mockSave,
  }));
}

// ---- Tests -----------------------------------------------------------------

describe("AiConfig — rendu initial", () => {
  it("affiche le nom de l'IA pré-rempli", () => {
    renderAiConfig();
    const input = screen.getByPlaceholderText("Ex : Sofia, Alex...") as HTMLInputElement;
    expect(input.value).toBe("Sofia");
  });

  it("affiche les 3 options de ton", () => {
    renderAiConfig();
    expect(screen.getByText("Amical")).toBeInTheDocument();
    expect(screen.getByText("Formel")).toBeInTheDocument();
    expect(screen.getByText("Casual")).toBeInTheDocument();
  });

  it("affiche les 5 langues disponibles", () => {
    renderAiConfig();
    expect(screen.getByText("Français")).toBeInTheDocument();
    expect(screen.getByText("English")).toBeInTheDocument();
    expect(screen.getByText("Español")).toBeInTheDocument();
    expect(screen.getByText("Português")).toBeInTheDocument();
  });

  it("affiche les 4 canaux", () => {
    renderAiConfig();
    expect(screen.getByText("WhatsApp")).toBeInTheDocument();
    expect(screen.getByText("SMS")).toBeInTheDocument();
    expect(screen.getByText("Messenger")).toBeInTheDocument();
    expect(screen.getByText("Telegram")).toBeInTheDocument();
  });

  it("affiche le bouton Sauvegarder", () => {
    renderAiConfig();
    expect(screen.getByText("Sauvegarder")).toBeInTheDocument();
  });
});

describe("AiConfig — répondeur téléphonique", () => {
  it("affiche Souscrire si voice_enabled = false", () => {
    renderAiConfig({ voice_enabled: false });
    expect(screen.getByText(/Souscrire/)).toBeInTheDocument();
  });

  it("affiche Activé + Désactiver si voice_enabled = true", () => {
    renderAiConfig({ voice_enabled: true, telnyx_phone_number: "+33100000000" });
    expect(screen.getByText("Activé")).toBeInTheDocument();
    expect(screen.getByText("+33100000000")).toBeInTheDocument();
    expect(screen.getByText("Désactiver le répondeur")).toBeInTheDocument();
  });
});

describe("AiConfig — interactions", () => {
  it("change le ton au clic", () => {
    renderAiConfig();
    const formelBtn = screen.getByText("Formel").closest("button")!;
    fireEvent.click(formelBtn);
    // Le bouton formel doit avoir la classe active
    expect(formelBtn.className).toContain("border-indigo-500");
  });

  it("toggle une langue au clic", () => {
    renderAiConfig();
    const espBtn = screen.getByText("Español").closest("button")!;
    // Español n'est pas actif par défaut (ai_languages = ["fr", "en"])
    expect(espBtn.className).not.toContain("border-indigo-500");
    fireEvent.click(espBtn);
    expect(espBtn.className).toContain("border-indigo-500");
  });

  it("appelle onSave avec les bonnes données au clic Sauvegarder", async () => {
    renderAiConfig();
    fireEvent.click(screen.getByText("Sauvegarder"));

    await vi.waitFor(() => {
      expect(mockSave).toHaveBeenCalledWith(
        expect.objectContaining({
          ai_name: "Sofia",
          ai_tone: "friendly",
          ai_languages: ["fr", "en"],
          cancellation_delay_minutes: 120,
        }),
      );
    });
  });
});
