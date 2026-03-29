import { logger } from "@/lib/logger";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";

interface SubscriptionLike {
  id: string;
  status: string;
  metadata: Record<string, string>;
  current_period_start: number;
  current_period_end: number;
}

type SubscriptionStatus = "active" | "cancelled" | "past_due";

const mapStripeStatus = (status: string): SubscriptionStatus => {
  if (status === "active" || status === "trialing") return "active";
  if (status === "canceled" || status === "unpaid" || status === "incomplete_expired") return "cancelled";
  if (status === "past_due" || status === "incomplete") return "past_due";
  return "active";
};

/**
 * T076 — Handle customer.subscription.updated event.
 * Met à jour le statut de l'abonnement client dans client_subscriptions.
 * Réinitialise current_period_uses quand la période change.
 */
export async function handleSubscriptionUpdated(
  subscription: unknown,
  supabase: SupabaseClient<Database>,
): Promise<void> {
  const sub = subscription as SubscriptionLike;
  const { merchant_id, client_id } = sub.metadata;

  if (!merchant_id || !client_id) {
    logger.warn("stripe.subscription_no_metadata", { subscriptionId: sub.id });
    return;
  }

  const newStatus = mapStripeStatus(sub.status);

  // Chercher l'abonnement client existant
  const { data: existing } = await supabase
    .from("client_subscriptions")
    .select("id, updated_at")
    .eq("stripe_subscription_id", sub.id)
    .eq("merchant_id", merchant_id)
    .single();

  if (!existing) {
    logger.warn("stripe.subscription_not_found", {
      subscriptionId: sub.id,
      merchantId: merchant_id,
    });
    return;
  }

  // Détecter un changement de période pour réinitialiser le compteur d'utilisations
  const periodStart = new Date(sub.current_period_start * 1000).toISOString();
  const lastUpdate = existing.updated_at;
  const periodChanged = periodStart > lastUpdate;

  const updatePayload: Record<string, unknown> = { status: newStatus };
  if (periodChanged) {
    updatePayload.current_period_uses = 0;
  }

  const { error } = await supabase
    .from("client_subscriptions")
    .update(updatePayload)
    .eq("id", existing.id)
    .eq("merchant_id", merchant_id);

  if (error) {
    logger.error("stripe.subscription_update_failed", {
      subscriptionId: sub.id,
      error: error.message,
    });
  } else {
    logger.info("stripe.subscription_updated", {
      subscriptionId: sub.id,
      newStatus,
      periodReset: periodChanged,
      merchantId: merchant_id,
    });
  }
}

/**
 * Handle customer.subscription.deleted event.
 * Marque l'abonnement client comme annulé.
 */
export async function handleSubscriptionDeleted(
  subscription: unknown,
  supabase: SupabaseClient<Database>,
): Promise<void> {
  const sub = subscription as SubscriptionLike;
  const { merchant_id } = sub.metadata;

  if (!merchant_id) {
    logger.warn("stripe.subscription_deleted_no_merchant", { subscriptionId: sub.id });
    return;
  }

  const { error } = await supabase
    .from("client_subscriptions")
    .update({ status: "cancelled" })
    .eq("stripe_subscription_id", sub.id)
    .eq("merchant_id", merchant_id);

  if (error) {
    logger.error("stripe.subscription_delete_failed", {
      subscriptionId: sub.id,
      error: error.message,
    });
  } else {
    logger.info("stripe.subscription_cancelled", {
      subscriptionId: sub.id,
      merchantId: merchant_id,
    });
  }
}
