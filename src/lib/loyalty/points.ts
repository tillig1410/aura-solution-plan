import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, LoyaltyTier } from "@/types/supabase";
import { logger } from "@/lib/logger";

interface PointsResult {
  success: boolean;
  points_added: number;
  total_points: number;
  new_tier: LoyaltyTier;
  tier_upgraded: boolean;
}

/**
 * Ajoute des points de fidélité au client après une prestation complétée.
 *
 * - Calcule les points à ajouter selon la config du programme (par visite + par euro)
 * - Met à jour le total et le palier du client
 * - Retourne si le palier a changé (pour déclencher une notification)
 */
export const addLoyaltyPoints = async (
  supabase: SupabaseClient<Database>,
  merchantId: string,
  clientId: string,
  amountCents: number,
  traceId?: string,
): Promise<PointsResult | null> => {
  // Charger le programme de fidélité du commerçant
  const { data: program } = await supabase
    .from("loyalty_programs")
    .select("*")
    .eq("merchant_id", merchantId)
    .single();

  if (!program || !program.is_active) {
    return null; // Pas de programme actif
  }

  // Charger le client
  const { data: client } = await supabase
    .from("clients")
    .select("loyalty_points, loyalty_tier")
    .eq("id", clientId)
    .eq("merchant_id", merchantId)
    .single();

  if (!client) {
    logger.error("loyalty.client_not_found", { clientId, merchantId, traceId });
    return null;
  }

  // Calculer les points (integer arithmetic to avoid float precision issues)
  const pointsPerVisit = program.points_per_visit;
  const pointsPerEuro = program.points_per_euro;
  const pointsAdded = pointsPerVisit + Math.floor((amountCents * pointsPerEuro) / 100);

  const totalPoints = client.loyalty_points + pointsAdded;

  // Déterminer le nouveau palier
  const oldTier = client.loyalty_tier as LoyaltyTier;
  const newTier = computeTier(totalPoints, program.silver_threshold, program.gold_threshold);
  const tierUpgraded = tierRank(newTier) > tierRank(oldTier);

  // Mettre à jour le client
  const { error } = await supabase
    .from("clients")
    .update({
      loyalty_points: totalPoints,
      loyalty_tier: newTier,
    })
    .eq("id", clientId)
    .eq("merchant_id", merchantId);

  if (error) {
    logger.error("loyalty.update_failed", { error: error.message, clientId, traceId });
    return null;
  }

  logger.info("loyalty.points_added", {
    clientId,
    merchantId,
    pointsAdded,
    totalPoints,
    newTier,
    tierUpgraded,
    traceId,
  });

  return {
    success: true,
    points_added: pointsAdded,
    total_points: totalPoints,
    new_tier: newTier,
    tier_upgraded: tierUpgraded,
  };
};

/**
 * Détermine le palier fidélité en fonction des points.
 */
export const computeTier = (
  points: number,
  silverThreshold: number,
  goldThreshold: number,
): LoyaltyTier => {
  if (points >= goldThreshold) return "gold";
  if (points >= silverThreshold) return "silver";
  return "bronze";
};

const tierRank = (tier: LoyaltyTier): number => {
  const ranks: Record<LoyaltyTier, number> = { bronze: 0, silver: 1, gold: 2 };
  return ranks[tier];
};
