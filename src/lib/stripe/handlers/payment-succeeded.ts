import { logger } from "@/lib/logger";
import type { SupabaseClient } from "@supabase/supabase-js";

interface PaymentIntentLike {
  id: string;
  amount: number;
  metadata: Record<string, string>;
}

/**
 * T065 — Handle payment_intent.succeeded event.
 * 1. Mark booking as paid (if booking_id in metadata)
 * 2. Create tip record if tip_amount_cents > 0 (attributed to named practitioner)
 */
export async function handlePaymentSucceeded(
  paymentIntent: unknown,
  supabase: SupabaseClient,
): Promise<void> {
  const pi = paymentIntent as PaymentIntentLike;
  const { merchant_id, booking_id, client_id, practitioner_id, tip_amount_cents } =
    pi.metadata;

  if (!merchant_id) {
    logger.warn("stripe.payment_no_merchant", { paymentIntentId: pi.id });
    return;
  }

  // 1. Mark booking as paid
  if (booking_id) {
    const { error } = await supabase
      .from("bookings")
      .update({ status: "confirmed" })
      .eq("id", booking_id)
      .eq("merchant_id", merchant_id);

    if (error) {
      logger.error("stripe.booking_update_failed", {
        bookingId: booking_id,
        error: error.message,
      });
    } else {
      logger.info("stripe.booking_paid", { bookingId: booking_id, merchantId: merchant_id });
    }
  }

  // 2. Create tip if amount > 0
  const tipCents = parseInt(tip_amount_cents, 10);
  if (tipCents > 0 && practitioner_id && client_id) {
    const { error } = await supabase.from("tips").insert({
      merchant_id,
      booking_id: booking_id || null,
      client_id,
      practitioner_id,
      amount_cents: tipCents,
      stripe_payment_intent_id: pi.id,
    });

    if (error) {
      logger.error("stripe.tip_insert_failed", {
        practitionerId: practitioner_id,
        error: error.message,
      });
    } else {
      logger.info("stripe.tip_created", {
        practitionerId: practitioner_id,
        amountCents: tipCents,
        merchantId: merchant_id,
      });
    }
  }
}
