import { describe, it, expect, vi } from "vitest";

/**
 * T070 — Unit tests: Loyalty points logic
 * Covers computeTier (pure) and addLoyaltyPoints (mock Supabase).
 */

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn() },
}));

const { computeTier, addLoyaltyPoints } = await import("@/lib/loyalty/points");

// ---- Helpers ----------------------------------------------------------------

/** Mock Supabase fluent chain que retourne toujours `result` en terminal */
function makeChain(result: unknown) {
  const chain: Record<string, unknown> = {};
  for (const m of ["eq", "gt", "gte", "not", "order", "limit", "select", "update", "insert"]) {
    chain[m] = vi.fn().mockReturnValue(chain);
  }
  chain["single"] = vi.fn().mockResolvedValue(result);
  chain["maybeSingle"] = vi.fn().mockResolvedValue(result);
  // .then() pour les appels awaitable directs
  (chain as unknown as Promise<unknown>)["then"] = undefined;
  return chain as ReturnType<typeof makeChain>;
}

function makeLoyaltySupabase(program: object | null, client: object | null, updateError: null | object = null) {
  const updateFn = vi.fn().mockReturnValue({
    eq: vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({ error: updateError }),
    }),
  });

  const from = vi.fn((table: string) => {
    if (table === "loyalty_programs") {
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: program, error: program ? null : { code: "PGRST116" } }),
          }),
        }),
      };
    }
    if (table === "clients") {
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: client, error: client ? null : { code: "PGRST116" } }),
            }),
          }),
        }),
        update: updateFn,
      };
    }
    return makeChain({ data: null, error: null });
  });

  return { from, updateFn };
}

const MERCHANT = "a1b2c3d4-e5f6-7890-abcd-ef1234567890";
const CLIENT   = "b1b2c3d4-e5f6-7890-abcd-ef1234567891";

const defaultProgram = {
  merchant_id: MERCHANT,
  is_active: true,
  points_per_visit: 10,
  points_per_euro: 1,
  silver_threshold: 200,
  gold_threshold: 500,
};

// ---- computeTier (pure) -------------------------------------------------------

describe("computeTier — paliers fidélité", () => {
  it("retourne bronze sous le seuil silver", () => {
    expect(computeTier(0, 200, 500)).toBe("bronze");
    expect(computeTier(199, 200, 500)).toBe("bronze");
  });

  it("retourne silver exactement sur le seuil silver", () => {
    expect(computeTier(200, 200, 500)).toBe("silver");
    expect(computeTier(499, 200, 500)).toBe("silver");
  });

  it("retourne gold à partir du seuil gold", () => {
    expect(computeTier(500, 200, 500)).toBe("gold");
    expect(computeTier(9999, 200, 500)).toBe("gold");
  });

  it("fonctionne avec des seuils personnalisés", () => {
    expect(computeTier(100, 100, 300)).toBe("silver");
    expect(computeTier(300, 100, 300)).toBe("gold");
  });
});

// ---- addLoyaltyPoints (mock Supabase) ----------------------------------------

describe("addLoyaltyPoints — calcul et mise à jour", () => {
  it("calcule les points : points_per_visit + floor(amountCents * points_per_euro / 100)", async () => {
    const client = { loyalty_points: 100, loyalty_tier: "bronze" };
    const { from } = makeLoyaltySupabase(defaultProgram, client);

    const result = await addLoyaltyPoints(
      { from } as never,
      MERCHANT, CLIENT,
      4500, // 45€
    );

    // 10 (visit) + floor(4500 * 1 / 100) = 10 + 45 = 55
    expect(result?.points_added).toBe(55);
    expect(result?.total_points).toBe(155);
    expect(result?.success).toBe(true);
  });

  it("détecte un upgrade de tier bronze → silver", async () => {
    const client = { loyalty_points: 195, loyalty_tier: "bronze" };
    const { from } = makeLoyaltySupabase(defaultProgram, client);

    // 10 (visit) + floor(0 / 100) = 10 → total 205 → silver
    const result = await addLoyaltyPoints({ from } as never, MERCHANT, CLIENT, 0);

    expect(result?.new_tier).toBe("silver");
    expect(result?.tier_upgraded).toBe(true);
  });

  it("ne détecte pas de tier_upgraded si le palier reste identique", async () => {
    const client = { loyalty_points: 50, loyalty_tier: "bronze" };
    const { from } = makeLoyaltySupabase(defaultProgram, client);

    const result = await addLoyaltyPoints({ from } as never, MERCHANT, CLIENT, 0);

    expect(result?.tier_upgraded).toBe(false);
    expect(result?.new_tier).toBe("bronze");
  });

  it("retourne null si aucun programme de fidélité actif", async () => {
    const { from } = makeLoyaltySupabase(null, null);

    const result = await addLoyaltyPoints({ from } as never, MERCHANT, CLIENT, 1000);

    expect(result).toBeNull();
  });

  it("retourne null si le programme est inactif", async () => {
    const inactiveProgram = { ...defaultProgram, is_active: false };
    const { from } = makeLoyaltySupabase(inactiveProgram, null);

    const result = await addLoyaltyPoints({ from } as never, MERCHANT, CLIENT, 1000);

    expect(result).toBeNull();
  });

  it("retourne null si le client est introuvable", async () => {
    const { from } = makeLoyaltySupabase(defaultProgram, null);

    const result = await addLoyaltyPoints({ from } as never, MERCHANT, CLIENT, 1000);

    expect(result).toBeNull();
  });

  it("retourne null si la mise à jour Supabase échoue", async () => {
    const client = { loyalty_points: 100, loyalty_tier: "bronze" };
    const { from } = makeLoyaltySupabase(defaultProgram, client, { message: "DB error" });

    const result = await addLoyaltyPoints({ from } as never, MERCHANT, CLIENT, 1000);

    expect(result).toBeNull();
  });

  it("utilise l'arithmetic entière pour éviter les erreurs float", async () => {
    const client = { loyalty_points: 0, loyalty_tier: "bronze" };
    const program = { ...defaultProgram, points_per_euro: 3, points_per_visit: 0 };
    const { from } = makeLoyaltySupabase(program, client);

    // 333.33 centimes → floor = 333 points (pas 333.33)
    const result = await addLoyaltyPoints({ from } as never, MERCHANT, CLIENT, 11111);
    expect(Number.isInteger(result?.points_added)).toBe(true);
  });
});
