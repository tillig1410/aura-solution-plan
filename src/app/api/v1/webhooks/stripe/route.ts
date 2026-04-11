import { NextResponse, type NextRequest } from "next/server";
import type Stripe from "stripe";
import { createAdminClient } from "@/lib/supabase/server";
import { getStripeClient } from "@/lib/stripe/client";
import { handlePaymentSucceeded } from "@/lib/stripe/handlers/payment-succeeded";
import { handleSubscriptionUpdated, handleSubscriptionDeleted } from "@/lib/stripe/handlers/subscription-updated";
import { handleInvoicePaid, handleInvoicePaymentFailed } from "@/lib/stripe/handlers/invoice-handlers";
import { handleChargeRefunded, handleChargeDisputeCreated } from "@/lib/stripe/handlers/charge-handlers";
import { logger, webhookLog } from "@/lib/logger";

/**
 * POST /api/v1/webhooks/stripe
 * Receives Stripe webhook events.
 * 1. Verify signature via Stripe SDK
 * 2. Check idempotency (dedup by event.id)
 * 3. Route to appropriate handler
 * 4. Return 200
 */
export async function POST(request: NextRequest) {
  const traceId = request.headers.get("x-trace-id") ?? undefined;
  webhookLog.received("stripe", traceId);

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    logger.error("stripe.webhook_secret_missing", { traceId });
    return NextResponse.json({ error: "Webhook not configured" }, { status: 500 });
  }

  const stripe = getStripeClient();
  const rawBody = await request.text();
  const signature = request.headers.get("stripe-signature") ?? "";

  // 1. Verify signature
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    logger.warn("stripe.signature_invalid", { error: msg, traceId });
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  const supabase = createAdminClient();

  // 2. Idempotency check — skip if event already processed
  const { data: existing } = await supabase
    .from("stripe_events")
    .select("id")
    .eq("id", event.id)
    .single();

  if (existing) {
    logger.info("stripe.event_duplicate", { eventId: event.id, traceId });
    return NextResponse.json({ status: "already_processed" });
  }

  // Record the event for idempotency
  const { error: insertError } = await supabase
    .from("stripe_events")
    .insert({ id: event.id, type: event.type });

  if (insertError) {
    // Unique constraint violation = event already being processed concurrently
    if (insertError.code === "23505") {
      logger.info("stripe.event_duplicate_race", { eventId: event.id, traceId });
      return NextResponse.json({ status: "already_processed" });
    }
    logger.error("stripe.event_insert_failed", { eventId: event.id, error: insertError.message, traceId });
    return NextResponse.json({ error: "Failed to record event" }, { status: 500 });
  }

  // 3. Route to handler
  try {
    switch (event.type) {
      case "payment_intent.succeeded":
        await handlePaymentSucceeded(event.data.object, supabase);
        break;

      case "payment_intent.payment_failed":
        logger.warn("stripe.payment_failed", {
          paymentIntentId: (event.data.object as { id: string }).id,
          traceId,
        });
        break;

      case "customer.subscription.updated":
        await handleSubscriptionUpdated(event.data.object, supabase);
        break;

      case "customer.subscription.deleted":
        await handleSubscriptionDeleted(event.data.object, supabase);
        break;

      case "account.updated": {
        const account = event.data.object as Stripe.Account;
        if (account.charges_enabled) {
          await supabase
            .from("merchants")
            .update({ stripe_account_id: account.id })
            .eq("stripe_account_id", account.id);
          logger.info("stripe.connect_updated", { accountId: account.id, traceId });
        }
        break;
      }

      case "invoice.paid":
        await handleInvoicePaid(event.data.object, supabase);
        break;

      case "invoice.payment_failed":
        await handleInvoicePaymentFailed(event.data.object, supabase);
        break;

      case "charge.refunded":
        await handleChargeRefunded(event.data.object, supabase);
        break;

      case "charge.dispute.created":
        await handleChargeDisputeCreated(event.data.object, supabase);
        break;

      default:
        logger.info("stripe.event_unhandled", { type: event.type, traceId });
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Handler error";
    const stack = err instanceof Error ? err.stack : undefined;
    logger.error("stripe.handler_error", {
      type: event.type,
      eventId: event.id,
      error: msg,
      stack,
      traceId,
    });
    // Still return 200 to prevent Stripe retries on application errors
  }

  return NextResponse.json({ status: "ok" });
}
