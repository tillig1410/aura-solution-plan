import { describe, it, expect } from "vitest";

/**
 * T075 — Unit tests: In-memory sliding window rate limiter
 * Logique pure, pas de mock nécessaire.
 */

const { checkRateLimit } = await import("@/lib/rate-limit");

// On utilise des clés uniques par test pour isoler l'état du store in-memory.

describe("checkRateLimit — sliding window", () => {
  it("autorise la première requête", () => {
    const result = checkRateLimit("test-first", 5, 60_000);

    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(4);
  });

  it("décompte remaining correctement", () => {
    const key = "test-remaining";
    checkRateLimit(key, 3, 60_000);
    checkRateLimit(key, 3, 60_000);
    const result = checkRateLimit(key, 3, 60_000);

    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(0);
  });

  it("bloque après maxRequests atteint", () => {
    const key = "test-blocked";
    for (let i = 0; i < 5; i++) checkRateLimit(key, 5, 60_000);

    const result = checkRateLimit(key, 5, 60_000);

    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
  });

  it("retourne resetAt dans le futur", () => {
    const now = Date.now();
    const result = checkRateLimit("test-reset", 10, 60_000);

    expect(result.resetAt).toBeGreaterThanOrEqual(now);
    expect(result.resetAt).toBeLessThanOrEqual(now + 60_000 + 100);
  });

  it("réautorise quand les timestamps sont hors fenêtre", () => {
    const key = "test-expire";
    // Remplir avec maxRequests
    checkRateLimit(key, 2, 60_000);
    checkRateLimit(key, 2, 60_000);

    // Avec une fenêtre de 60s, on est bloqué
    expect(checkRateLimit(key, 2, 60_000).allowed).toBe(false);

    // Mais avec une fenêtre de 0ms, les anciens timestamps expirent
    const result = checkRateLimit(key, 2, 0);
    expect(result.allowed).toBe(true);
  });

  it("isole les clés différentes", () => {
    for (let i = 0; i < 3; i++) checkRateLimit("test-key-a", 3, 60_000);

    const resultA = checkRateLimit("test-key-a", 3, 60_000);
    const resultB = checkRateLimit("test-key-b", 3, 60_000);

    expect(resultA.allowed).toBe(false);
    expect(resultB.allowed).toBe(true);
  });
});
