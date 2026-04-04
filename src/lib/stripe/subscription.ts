import Stripe from "stripe";
import { logger } from "@/lib/logger";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY ?? "", {
  apiVersion: "2026-03-25.dahlia",
});

/**
 * T070 — Merchant subscription helper.
 * Handles Plan subscriptions based on seat count with pricing tiers.
 */

/**
 * Plan pricing grid (monthly, in cents).
 * Base: 16,90€ (1 seat), up to 54,90€ (7 seats).
 * Voice option: +7€ to +52€/month depending on seat count.
 */
const SEAT_PRICES: Record<number, { base: number; voice: number }> = {
  1: { base: 1690, voice: 700 },
  2: { base: 2490, voice: 1400 },
  3: { base: 3190, voice: 2100 },
  4: { base: 3890, voice: 2800 },
  5: { base: 4490, voice: 3500 },
  6: { base: 4990, voice: 4200 },
  7: { base: 5490, voice: 5200 },
};

const EARLY_ADOPTER_COUPON_ID = process.env.STRIPE_EARLY_ADOPTER_COUPON_ID;

interface CreateSubscriptionParams {
  customerId: string;
  seatCount: number;
  voiceEnabled: boolean;
  earlyAdopter?: boolean;
}

/**
 * Calculate the monthly price in cents for a given configuration.
 */
export function calculatePrice(seatCount: number, voiceEnabled: boolean): number {
  const clampedSeats = Math.max(1, Math.min(7, seatCount));
  const tier = SEAT_PRICES[clampedSeats];
  return tier.base + (voiceEnabled ? tier.voice : 0);
}

/**
 * Create a Stripe subscription for a merchant.
 */
export async function createMerchantSubscription(
  params: CreateSubscriptionParams,
): Promise<{ subscriptionId: string; clientSecret: string | null }> {
  const { customerId, seatCount, voiceEnabled, earlyAdopter } = params;
  const priceCents = calculatePrice(seatCount, voiceEnabled);

  // Create an inline price for the subscription
  const subscriptionParams: Stripe.SubscriptionCreateParams = {
    customer: customerId,
    items: [
      {
        price_data: {
          currency: "eur",
          product: process.env.STRIPE_PLAN_PRODUCT_ID ?? "",
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

  const subscription = await stripe.subscriptions.create(subscriptionParams);

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
          product: process.env.STRIPE_PLAN_PRODUCT_ID ?? "",
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
 */
export async function getOrCreateCustomer(
  email: string,
  merchantName: string,
  merchantId: string,
): Promise<string> {
  // Search for existing customer
  const existing = await stripe.customers.list({ email, limit: 1 });
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
