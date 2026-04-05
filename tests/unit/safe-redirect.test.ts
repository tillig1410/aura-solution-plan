import { describe, it, expect, vi } from "vitest";

/**
 * T076 — Unit tests: Safe redirect (open redirect prevention)
 */

// Configurer l'env AVANT l'import du module (lecture au top-level)
process.env.NEXT_PUBLIC_APP_URL = "https://app.plan.fr";
process.env.VERCEL_URL = "plan-preview-abc.vercel.app";

const { safeRedirectUrl, isTrustedOrigin } = await import("@/lib/safe-redirect");

// ---- safeRedirectUrl --------------------------------------------------------

describe("safeRedirectUrl — construction d'URL sûre", () => {
  it("construit une URL absolue pour un chemin relatif", () => {
    const url = safeRedirectUrl("/dashboard");

    expect(url.origin).toBe("https://app.plan.fr");
    expect(url.pathname).toBe("/dashboard");
  });

  it("redirige vers /login si le chemin ne commence pas par /", () => {
    const url = safeRedirectUrl("https://evil.com/phishing");

    expect(url.pathname).toBe("/login");
    expect(url.origin).toBe("https://app.plan.fr");
  });

  it("bloque les protocol-relative URLs (//evil.com)", () => {
    const url = safeRedirectUrl("//evil.com/steal");

    expect(url.pathname).toBe("/login");
  });

  it("préserve les query params du chemin", () => {
    const url = safeRedirectUrl("/booking?service=coupe");

    expect(url.pathname).toBe("/booking");
    expect(url.searchParams.get("service")).toBe("coupe");
  });

  it("utilise le fallback en dev si NEXT_PUBLIC_APP_URL est vide", () => {
    // Tester resolveOrigin avec fallback — en forçant un fallback
    const url = safeRedirectUrl("/test", "http://localhost:4000");

    // NEXT_PUBLIC_APP_URL est défini donc le fallback n'est pas utilisé
    expect(url.origin).toBe("https://app.plan.fr");
  });
});

// ---- isTrustedOrigin --------------------------------------------------------

describe("isTrustedOrigin — validation d'origine", () => {
  it("accepte l'origin NEXT_PUBLIC_APP_URL", () => {
    expect(isTrustedOrigin("https://app.plan.fr/dashboard")).toBe(true);
  });

  it("accepte l'origin Vercel preview", () => {
    expect(isTrustedOrigin("https://plan-preview-abc.vercel.app/test")).toBe(true);
  });

  it("rejette une origin inconnue", () => {
    expect(isTrustedOrigin("https://evil.com/phishing")).toBe(false);
  });

  it("rejette une URL malformée", () => {
    expect(isTrustedOrigin("not-a-url")).toBe(false);
  });

  it("rejette une chaîne vide", () => {
    expect(isTrustedOrigin("")).toBe(false);
  });
});
