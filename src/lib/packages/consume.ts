import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";
import { logger } from "@/lib/logger";

interface ConsumeResult {
  success: boolean;
  error?: string;
  remaining_uses?: number;
  client_package_id?: string;
}

/**
 * Consomme une utilisation d'un forfait actif du client pour un service donné.
 *
 * Vérifie :
 * 1. Le forfait a des utilisations restantes (remaining_uses > 0)
 * 2. Le forfait n'est pas expiré (expires_at > now ou null)
 * 3. Le forfait est actif
 *
 * Retourne le résultat avec remaining_uses après décompte.
 */
export const consumePackage = async (
  supabase: SupabaseClient<Database>,
  merchantId: string,
  clientId: string,
  serviceId: string,
  traceId?: string,
): Promise<ConsumeResult> => {
  // Chercher un forfait actif pour ce client + service
  const { data: clientPackages, error: fetchError } = await supabase
    .from("client_packages")
    .select("id, remaining_uses, expires_at, package:packages(id, service_id, is_active)")
    .eq("merchant_id", merchantId)
    .eq("client_id", clientId)
    .gt("remaining_uses", 0)
    .order("expires_at", { ascending: true, nullsFirst: false });

  if (fetchError) {
    logger.error("packages.consume_fetch_failed", { error: fetchError.message, traceId });
    return { success: false, error: "Failed to fetch client packages" };
  }

  if (!clientPackages || clientPackages.length === 0) {
    return { success: false, error: "No active package found" };
  }

  // Filtrer : service correspondant, actif, non expiré
  const now = new Date().toISOString();
  const eligible = clientPackages.find((cp) => {
    const pkg = cp.package as unknown as { id: string; service_id: string; is_active: boolean } | null;
    if (!pkg || !pkg.is_active || pkg.service_id !== serviceId) return false;
    if (cp.expires_at && cp.expires_at < now) return false;
    return true;
  });

  if (!eligible) {
    return { success: false, error: "No eligible package for this service" };
  }

  const newRemaining = eligible.remaining_uses - 1;

  const { error: updateError } = await supabase
    .from("client_packages")
    .update({ remaining_uses: newRemaining })
    .eq("id", eligible.id)
    .eq("remaining_uses", eligible.remaining_uses); // Optimistic lock

  if (updateError) {
    logger.error("packages.consume_update_failed", { error: updateError.message, traceId });
    return { success: false, error: "Failed to consume package (concurrent update)" };
  }

  logger.info("packages.consumed", {
    clientPackageId: eligible.id,
    remaining: newRemaining,
    clientId,
    serviceId,
    traceId,
  });

  return {
    success: true,
    remaining_uses: newRemaining,
    client_package_id: eligible.id,
  };
};

/**
 * Vérifie si un client a un forfait ou abonnement actif pour un service donné.
 * Utilisé par le workflow n8n pour décider si le paiement est requis.
 */
export const hasActivePackageOrSubscription = async (
  supabase: SupabaseClient<Database>,
  merchantId: string,
  clientId: string,
  serviceId: string,
): Promise<{ hasPackage: boolean; hasSubscription: boolean }> => {
  const now = new Date().toISOString();

  // Vérifier forfaits
  const { data: packages } = await supabase
    .from("client_packages")
    .select("id, remaining_uses, expires_at, package:packages(service_id, is_active)")
    .eq("merchant_id", merchantId)
    .eq("client_id", clientId)
    .gt("remaining_uses", 0);

  const hasPackage = (packages ?? []).some((cp) => {
    const pkg = cp.package as unknown as { service_id: string; is_active: boolean } | null;
    if (!pkg || !pkg.is_active || pkg.service_id !== serviceId) return false;
    if (cp.expires_at && cp.expires_at < now) return false;
    return true;
  });

  // Vérifier abonnements
  const { data: subscriptions } = await supabase
    .from("client_subscriptions")
    .select("id")
    .eq("merchant_id", merchantId)
    .eq("client_id", clientId)
    .eq("service_id", serviceId)
    .eq("status", "active")
    .limit(1);

  const hasSubscription = (subscriptions ?? []).length > 0;

  return { hasPackage, hasSubscription };
};
