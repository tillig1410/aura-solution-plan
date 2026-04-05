import { describe, it, expect } from "vitest";
import { apiError } from "@/lib/api-error";
import { formatEuros } from "@/lib/utils";

/**
 * T077 — Unit tests: apiError + formatEuros
 */

// ---- apiError ---------------------------------------------------------------

describe("apiError — réponse API standardisée", () => {
  it("retourne le status HTTP correct", () => {
    const res = apiError("Not found", 404);
    expect(res.status).toBe(404);
  });

  it("retourne le body JSON avec error", async () => {
    const res = apiError("Forbidden", 403);
    const body = await res.json();
    expect(body.error).toBe("Forbidden");
  });

  it("inclut code si fourni", async () => {
    const res = apiError("Bad input", 400, { code: "VALIDATION_ERROR" });
    const body = await res.json();
    expect(body.code).toBe("VALIDATION_ERROR");
  });

  it("inclut traceId dans le body ET le header", async () => {
    const res = apiError("Server error", 500, { traceId: "trace-abc-123" });
    const body = await res.json();

    expect(body.traceId).toBe("trace-abc-123");
    expect(res.headers.get("X-Trace-Id")).toBe("trace-abc-123");
  });

  it("n'inclut pas les champs optionnels s'ils ne sont pas fournis", async () => {
    const res = apiError("Error", 400);
    const body = await res.json();

    expect(body).not.toHaveProperty("code");
    expect(body).not.toHaveProperty("traceId");
    expect(body).not.toHaveProperty("details");
  });

  it("inclut details si fourni", async () => {
    const details = { field: "email", reason: "invalid" };
    const res = apiError("Validation", 422, { details });
    const body = await res.json();

    expect(body.details).toEqual(details);
  });
});

// ---- formatEuros ------------------------------------------------------------

describe("formatEuros — formatage centimes → euros", () => {
  it("formate 42800 centimes en euros", () => {
    const result = formatEuros(42800);
    // Intl.NumberFormat fr-FR : "428 €" (narrow no-break space possible)
    expect(result).toContain("428");
    expect(result).toContain("€");
  });

  it("formate 0 centime", () => {
    const result = formatEuros(0);
    expect(result).toContain("0");
    expect(result).toContain("€");
  });

  it("formate des petits montants (99 centimes)", () => {
    const result = formatEuros(99);
    // 99/100 = 0.99 → arrondi à 1 € (maximumFractionDigits: 0)
    expect(result).toContain("€");
  });

  it("retourne un nombre entier (pas de décimales)", () => {
    const result = formatEuros(1690);
    // 16.90 arrondi à 17 €
    expect(result).not.toMatch(/\.\d/);
  });
});
