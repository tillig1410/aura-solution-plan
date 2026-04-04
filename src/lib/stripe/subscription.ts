import Stripe from "stripe";
import { logger } from "@/lib/logger";

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error("STRIPE_SECRET_KEY is not configured");
}
if (!process.env.STRIPE_PLAN_PRODUCT_ID) {
  throw new Error("STRIPE_PLAN_PRODUCT_ID is not configured");
}

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: "2026-03-25.dahlia",
});

/**
 * T070 — Merchant subscription helper.
 * Handles Plan subscriptions based on seat count with pricing tiers.
 */

import { calculatePrice } from "@/lib/stripe/pricing";
export { calculatePrice } from "@/lib/stripe/pricing";

const EARLY_ADOPTER_COUPON_ID = process.env.STRIPE_EARLY_ADOPTER_COUPON_ID;

interface CreateSubscriptionParams {
  customerId: string;
  seatCount: number;
  voiceEnabled: boolean;
  earlyAdopter?: boolean;
  /** Idempotency key to prevent duplicate subscription creation on retries */
  idempotencyKey: string;
}

/**
 * Create a Stripe subscription for a merchant.
 */
export async function createMerchantSubscription(
  params: CreateSubscriptionParams,
): Promise<{ subscriptionId: string; clientSecret: string | null }> {
  const { customerId, seatCount, voiceEnabled, earlyAdopter, idempotencyKey } = params;
  const priceCents = calculatePrice(seatCount, voiceEnabled);

  // Create an inline price for the subscription
  const subscriptionParams: Stripe.SubscriptionCreateParams = {
    customer: customerId,
    items: [
      {
        price_data: {
          currency: "eur",
          product: process.env.STRIPE_PLAN_PRODUCT_ID!,
          unit_amount: priceCents,
          recurring: { interval: "month" },
        },
      },
    ],
    payment_behavior: "default_incomplete",
    payment_settings: { save_default_payment_method: "on_subscription" },
    expand: ["latest_invoice.payment_intent"],
    metadata: {
      seat_count: String(seatCount),
      voice_enabled: String(voiceEnabled),
      source: "plan-saas",
    },
  };

  // Apply Early Adopter coupon (-30% for life)
  if (earlyAdopter && EARLY_ADOPTER_COUPON_ID) {
    subscriptionParams.discounts = [{ coupon: EARLY_ADOPTER_COUPON_ID }];
  }

  const subscription = await stripe.subscriptions.create(subscriptionParams, {
    idempotencyKey,
  });

  const invoice = subscription.latest_invoice as Stripe.Invoice | null;
  // Stripe expands payment_intent when requested — cast via Record to avoid strict type mismatch
  const invoiceRecord = invoice as Record<string, unknown> | null;
  const paymentIntent = (invoiceRecord?.payment_intent as Stripe.PaymentIntent | undefined) ?? null;

  logger.info("stripe.subscription_created", {
    subscriptionId: subscription.id,
    customerId,
    seatCount,
    voiceEnabled,
    priceCents,
    earlyAdopter: !!earlyAdopter,
  });

  return {
    subscriptionId: subscription.id,
    clientSecret: paymentIntent?.client_secret ?? null,
  };
}

/**
 * Update an existing subscription (seat count or voice option change).
 */
export async function updateMerchantSubscription(
  subscriptionId: string,
  seatCount: number,
  voiceEnabled: boolean,
): Promise<void> {
  const priceCents = calculatePrice(seatCount, voiceEnabled);

  const subscription = await stripe.subscriptions.retrieve(subscriptionId);
  const itemId = subscription.items.data[0]?.id;
  if (!itemId) throw new Error("No subscription item found");

  await stripe.subscriptions.update(subscriptionId, {
    items: [
      {
        id: itemId,
        price_data: {
          currency: "eur",
          product: process.env.STRIPE_PLAN_PRODUCT_ID!,
          unit_amount: priceCents,
          recurring: { interval: "month" },
        },
      },
    ],
    metadata: {
      seat_count: String(seatCount),
      voice_enabled: String(voiceEnabled),
    },
    proration_behavior: "create_prorations",
  });

  logger.info("stripe.subscription_updated", { subscriptionId, seatCount, voiceEnabled, priceCents });
}

/**
 * Cancel a subscription at period end.
 */
export async function cancelMerchantSubscription(subscriptionId: string): Promise<void> {
  await stripe.subscriptions.update(subscriptionId, {
    cancel_at_period_end: true,
  });

  logger.info("stripe.subscription_cancelled", { subscriptionId });
}

/**
 * Create or retrieve a Stripe customer for a merchant.
 * Pass stripeCustomerId when available to avoid email-based lookup ambiguity.
 */
export async function getOrCreateCustomer(
  email: string,
  merchantName: string,
  merchantId: string,
  stripeCustomerId?: string | null,
): Promise<string> {
  // Fast path: reuse known customer ID
  if (stripeCustomerId) {
    return stripeCustomerId;
  }

  // Search by metadata merchant_id for precision (avoids email collisions)
  const existing = await stripe.customers.search({
    query: `metadata["merchant_id"]:"${merchantId}"`,
    limit: 1,
  });
  if (existing.data.length > 0) {
    return existing.data[0].id;
  }

  const customer = await stripe.customers.create({
    email,
    name: merchantName,
    metadata: { merchant_id: merchantId, source: "plan-saas" },
  });

  return customer.id;
}
