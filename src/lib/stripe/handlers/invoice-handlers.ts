import { logger } from "@/lib/logger";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";

interface InvoiceLike {
  id: string;
  subscription: string | null;
  metadata: Record<string, string> | null;
  billing_reason: string | null;
}

/**
 * Handle invoice.paid — met à jour le statut de l'abonnement Plan du commerçant.
 * Distingue les abonnements Plan (source: "plan-saas") des abonnements clients.
 */
export async function handleInvoicePaid(
  invoice: unknown,
  supabase: SupabaseClient<Database>,
): Promise<void> {
  const inv = invoice as InvoiceLike;

  if (!inv.subscription) {
    logger.info("stripe.invoice_paid_no_subscription", { invoiceId: inv.id });
    return;
  }

  // Vérifier si c'est un abonnement Plan SaaS (via metadata sur la subscription)
  const metadata = inv.metadata ?? {};
  if (metadata.source === "plan-saas") {
    // Mettre à jour le commerçant : abonnement actif
    const { error } = await supabase
      .from("merchants")
      .update({ stripe_subscription_id: inv.subscription })
      .eq("stripe_subscription_id", inv.subscription);

    if (error) {
      logger.error("stripe.invoice_paid_merchant_update_failed", {
        invoiceId: inv.id,
        subscriptionId: inv.subscription,
        error: error.message,
      });
    } else {
      logger.info("stripe.invoice_paid_plan", {
        invoiceId: inv.id,
        subscriptionId: inv.subscription,
        billingReason: inv.billing_reason,
      });
    }
    return;
  }

  // Abonnement client (barbe illimitée, etc.) — mettre à jour client_subscriptions
  const { error } = await supabase
    .from("client_subscriptions")
    .update({ status: "active" })
    .eq("stripe_subscription_id", inv.subscription);

  if (error) {
    logger.error("stripe.invoice_paid_client_sub_failed", {
      invoiceId: inv.id,
      subscriptionId: inv.subscription,
      error: error.message,
    });
  } else {
    logger.info("stripe.invoice_paid_client", {
      invoiceId: inv.id,
      subscriptionId: inv.subscription,
    });
  }
}

/**
 * Handle invoice.payment_failed — marque l'abonnement comme past_due.
 * Pour les abonnements Plan, log un warning critique (le commerçant perd l'accès).
 */
export async function handleInvoicePaymentFailed(
  invoice: unknown,
  supabase: SupabaseClient<Database>,
): Promise<void> {
  const inv = invoice as InvoiceLike;

  if (!inv.subscription) {
    logger.warn("stripe.invoice_failed_no_subscription", { invoiceId: inv.id });
    return;
  }

  const metadata = inv.metadata ?? {};
  if (metadata.source === "plan-saas") {
    // Abonnement Plan du commerçant — alerte critique
    logger.warn("stripe.invoice_failed_plan_subscription", {
      invoiceId: inv.id,
      subscriptionId: inv.subscription,
      billingReason: inv.billing_reason,
    });
    // Note: Stripe gère le dunning automatique (Smart Retries).
    // L'accès sera suspendu via customer.subscription.updated → past_due/cancelled.
    return;
  }

  // Abonnement client — marquer past_due
  const { error } = await supabase
    .from("client_subscriptions")
    .update({ status: "past_due" })
    .eq("stripe_subscription_id", inv.subscription);

  if (error) {
    logger.error("stripe.invoice_failed_client_sub_update", {
      invoiceId: inv.id,
      subscriptionId: inv.subscription,
      error: error.message,
    });
  } else {
    logger.warn("stripe.invoice_failed_client", {
      invoiceId: inv.id,
      subscriptionId: inv.subscription,
    });
  }
}
