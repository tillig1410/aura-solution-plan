import { describe, it, expect, vi } from "vitest";

/**
 * T071 — Unit tests: Package consumption logic
 * Covers consumePackage and hasActivePackageOrSubscription.
 */

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn() },
}));

const { consumePackage, hasActivePackageOrSubscription } = await import("@/lib/packages/consume");

// ---- Helpers ----------------------------------------------------------------

const MERCHANT = "a1b2c3d4-e5f6-7890-abcd-ef1234567890";
const CLIENT   = "b1b2c3d4-e5f6-7890-abcd-ef1234567891";
const SERVICE  = "c1b2c3d4-e5f6-7890-abcd-ef1234567892";
const PKG_ID   = "d1b2c3d4-e5f6-7890-abcd-ef1234567893";

function makeClientPackage(overrides: Record<string, unknown> = {}) {
  return {
    id: PKG_ID,
    remaining_uses: 3,
    expires_at: null,
    package: { id: "pkg-1", service_id: SERVICE, is_active: true },
    ...overrides,
  };
}

function makeConsumeSupabase(packages: object[] | null, updateError: object | null = null, updatedRows: object[] = [{ id: "cp-1" }]) {
  const updateFn = vi.fn().mockReturnValue({
    eq: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        select: vi.fn().mockResolvedValue({ data: updateError ? null : updatedRows, error: updateError }),
      }),
    }),
  });

  const from = vi.fn((table: string) => {
    if (table === "client_packages") {
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnThis(),
          gt: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({
              data: packages,
              error: packages === null ? { message: "DB error" } : null,
            }),
          }),
        }),
        update: updateFn,
      };
    }
    return {};
  });

  return { from, updateFn };
}

// ---- consumePackage ---------------------------------------------------------

describe("consumePackage — consommation forfait", () => {
  it("consomme une utilisation et retourne remaining_uses décrémenté", async () => {
    const pkg = makeClientPackage({ remaining_uses: 3 });
    const { from, updateFn } = makeConsumeSupabase([pkg]);

    const result = await consumePackage({ from } as never, MERCHANT, CLIENT, SERVICE);

    expect(result.success).toBe(true);
    expect(result.remaining_uses).toBe(2);
    expect(result.client_package_id).toBe(PKG_ID);
    expect(updateFn).toHaveBeenCalledWith({ remaining_uses: 2 });
  });

  it("utilise l'optimistic lock (eq remaining_uses)", async () => {
    const pkg = makeClientPackage({ remaining_uses: 2 });
    const { from, updateFn } = makeConsumeSupabase([pkg]);

    await consumePackage({ from } as never, MERCHANT, CLIENT, SERVICE);

    // Le 2e .eq doit utiliser la valeur courante pour éviter les races
    const eqChain = updateFn.mock.results[0].value.eq.mock.results[0].value.eq;
    expect(eqChain).toHaveBeenCalledWith("remaining_uses", 2);
  });

  it("échoue si aucun forfait disponible", async () => {
    const { from } = makeConsumeSupabase([]);

    const result = await consumePackage({ from } as never, MERCHANT, CLIENT, SERVICE);

    expect(result.success).toBe(false);
    expect(result.error).toContain("No active package");
  });

  it("ignore les forfaits pour un service différent", async () => {
    const pkg = makeClientPackage({
      package: { id: "pkg-other", service_id: "other-service-id", is_active: true },
    });
    const { from } = makeConsumeSupabase([pkg]);

    const result = await consumePackage({ from } as never, MERCHANT, CLIENT, SERVICE);

    expect(result.success).toBe(false);
    expect(result.error).toContain("No eligible package");
  });

  it("ignore les forfaits expirés", async () => {
    const pkg = makeClientPackage({ expires_at: "2020-01-01T00:00:00Z" });
    const { from } = makeConsumeSupabase([pkg]);

    const result = await consumePackage({ from } as never, MERCHANT, CLIENT, SERVICE);

    expect(result.success).toBe(false);
    expect(result.error).toContain("No eligible package");
  });

  it("accepte les forfaits sans date d'expiration (null = illimité)", async () => {
    const pkg = makeClientPackage({ expires_at: null });
    const { from } = makeConsumeSupabase([pkg]);

    const result = await consumePackage({ from } as never, MERCHANT, CLIENT, SERVICE);

    expect(result.success).toBe(true);
  });

  it("ignore les forfaits dont le package est inactif", async () => {
    const pkg = makeClientPackage({
      package: { id: "pkg-1", service_id: SERVICE, is_active: false },
    });
    const { from } = makeConsumeSupabase([pkg]);

    const result = await consumePackage({ from } as never, MERCHANT, CLIENT, SERVICE);

    expect(result.success).toBe(false);
  });

  it("retourne une erreur si la mise à jour Supabase échoue", async () => {
    const pkg = makeClientPackage();
    const { from } = makeConsumeSupabase([pkg], { message: "conflict" });

    const result = await consumePackage({ from } as never, MERCHANT, CLIENT, SERVICE);

    expect(result.success).toBe(false);
    expect(result.error).toContain("concurrent update");
  });

  it("retourne une erreur si la lecture Supabase échoue", async () => {
    const { from } = makeConsumeSupabase(null);

    const result = await consumePackage({ from } as never, MERCHANT, CLIENT, SERVICE);

    expect(result.success).toBe(false);
    expect(result.error).toContain("Failed to fetch");
  });
});

// ---- hasActivePackageOrSubscription -----------------------------------------

describe("hasActivePackageOrSubscription — vérification forfait/abonnement", () => {
  function makeHasSupabase(packages: object[], subscriptions: object[]) {
    const packagesChain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      gt: vi.fn().mockResolvedValue({ data: packages }),
    };

    const subscriptionsChain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue({ data: subscriptions }),
    };

    const from = vi.fn((table: string) => {
      if (table === "client_packages") return packagesChain;
      if (table === "client_subscriptions") return subscriptionsChain;
      return {};
    });

    return { from };
  }

  it("retourne hasPackage=true si forfait actif pour ce service", async () => {
    const pkg = makeClientPackage();
    const { from } = makeHasSupabase([pkg], []);

    const result = await hasActivePackageOrSubscription({ from } as never, MERCHANT, CLIENT, SERVICE);

    expect(result.hasPackage).toBe(true);
    expect(result.hasSubscription).toBe(false);
  });

  it("retourne hasSubscription=true si abonnement actif", async () => {
    const { from } = makeHasSupabase([], [{ id: "sub-1" }]);

    const result = await hasActivePackageOrSubscription({ from } as never, MERCHANT, CLIENT, SERVICE);

    expect(result.hasPackage).toBe(false);
    expect(result.hasSubscription).toBe(true);
  });

  it("retourne false/false si aucun forfait ni abonnement", async () => {
    const { from } = makeHasSupabase([], []);

    const result = await hasActivePackageOrSubscription({ from } as never, MERCHANT, CLIENT, SERVICE);

    expect(result.hasPackage).toBe(false);
    expect(result.hasSubscription).toBe(false);
  });

  it("ignore les forfaits pour un autre service", async () => {
    const pkg = makeClientPackage({
      package: { id: "pkg-1", service_id: "other-service", is_active: true },
    });
    const { from } = makeHasSupabase([pkg], []);

    const result = await hasActivePackageOrSubscription({ from } as never, MERCHANT, CLIENT, SERVICE);

    expect(result.hasPackage).toBe(false);
  });

  it("ignore les forfaits expirés", async () => {
    const pkg = makeClientPackage({ expires_at: "2020-01-01T00:00:00Z" });
    const { from } = makeHasSupabase([pkg], []);

    const result = await hasActivePackageOrSubscription({ from } as never, MERCHANT, CLIENT, SERVICE);

    expect(result.hasPackage).toBe(false);
  });
});
