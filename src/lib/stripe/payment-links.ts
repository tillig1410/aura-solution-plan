import Stripe from "stripe";
import { logger } from "@/lib/logger";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY ?? "", {
  apiVersion: "2026-03-25.dahlia",
});

/**
 * T067 — Payment Links helper.
 * Generates Stripe Checkout sessions for post-prestation payment with optional tip.
 */

interface PaymentLinkParams {
  /** Stripe Connect account ID of the merchant */
  connectedAccountId: string;
  /** Service price in cents */
  amountCents: number;
  /** Service name (for the line item description) */
  serviceName: string;
  /** Metadata to include in the PaymentIntent for webhook processing */
  metadata: {
    merchant_id: string;
    booking_id: string;
    client_id: string;
    practitioner_id: string;
  };
  /** Optional: pre-set tip amounts in cents for the client to choose from */
  tipOptions?: number[];
  /** Idempotency key to prevent duplicate checkout sessions on retries */
  idempotencyKey?: string;
}

/**
 * Create a Stripe Checkout session with optional tip for the named practitioner.
 * Returns the checkout URL to send to the client via messaging channel.
 */
export async function createPaymentCheckout(
  params: PaymentLinkParams,
): Promise<string> {
  const { connectedAccountId, amountCents, serviceName, metadata, tipOptions, idempotencyKey } = params;

  const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = [
    {
      price_data: {
        currency: "eur",
        product_data: { name: serviceName },
        unit_amount: amountCents,
      },
      quantity: 1,
    },
  ];

  // Add tip options as optional line items
  if (tipOptions && tipOptions.length > 0) {
    for (const tipCents of tipOptions) {
      lineItems.push({
        price_data: {
          currency: "eur",
          product_data: {
            name: `Pourboire ${(tipCents / 100).toFixed(2).replace(".", ",")} €`,
          },
          unit_amount: tipCents,
        },
        quantity: 1,
        adjustable_quantity: { enabled: true, minimum: 0, maximum: 1 },
      });
    }
  }

  const session = await stripe.checkout.sessions.create(
    {
      mode: "payment",
      line_items: lineItems,
      payment_intent_data: {
        metadata: {
          ...metadata,
          // Tip amount is resolved post-checkout via line item analysis
        },
      },
      success_url: `${process.env.NEXT_PUBLIC_APP_URL}/payment/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/payment/cancel`,
      locale: "fr",
    },
    {
      stripeAccount: connectedAccountId,
      idempotencyKey: idempotencyKey ?? `checkout_${metadata.booking_id}`,
    },
  );

  logger.info("stripe.checkout_created", {
    sessionId: session.id,
    bookingId: metadata.booking_id,
    merchantId: metadata.merchant_id,
  });

  if (!session.url) {
    throw new Error(`Stripe checkout session ${session.id} returned no URL`);
  }

  return session.url;
}

/**
 * Create a simple payment link (no Checkout session) for recurring use.
 * Useful for embedding in automated messages.
 */
export async function createSimplePaymentLink(
  connectedAccountId: string,
  amountCents: number,
  serviceName: string,
  metadata: Record<string, string>,
  idempotencyKey?: string,
): Promise<string> {
  const baseKey = idempotencyKey ?? `plink_${connectedAccountId}_${serviceName}_${amountCents}`;

  const product = await stripe.products.create(
    { name: serviceName },
    { stripeAccount: connectedAccountId, idempotencyKey: `${baseKey}_product` },
  );

  const price = await stripe.prices.create(
    {
      product: product.id,
      unit_amount: amountCents,
      currency: "eur",
    },
    { stripeAccount: connectedAccountId, idempotencyKey: `${baseKey}_price` },
  );

  const paymentLink = await stripe.paymentLinks.create(
    {
      line_items: [{ price: price.id, quantity: 1 }],
      metadata,
    },
    { stripeAccount: connectedAccountId, idempotencyKey: `${baseKey}_link` },
  );

  return paymentLink.url;
}
