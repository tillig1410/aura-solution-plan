import { logger } from "@/lib/logger";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TIP_MAX_CENTS = 100_000; // 1 000 € — plafond anti-abus

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
  supabase: SupabaseClient<Database>,
): Promise<void> {
  const pi = paymentIntent as PaymentIntentLike;
  const { merchant_id, booking_id, client_id, practitioner_id, tip_amount_cents } =
    pi.metadata;

  if (!merchant_id || !UUID_RE.test(merchant_id)) {
    logger.warn("stripe.payment_no_merchant", { paymentIntentId: pi.id });
    return;
  }

  // 1. Mark booking as paid
  if (booking_id && UUID_RE.test(booking_id)) {
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

  // 2. Create tip if amount > 0 and within safe bounds
  const tipCents = parseInt(tip_amount_cents ?? "0", 10);
  if (
    tipCents > 0 &&
    tipCents <= TIP_MAX_CENTS &&
    practitioner_id && UUID_RE.test(practitioner_id) &&
    client_id && UUID_RE.test(client_id)
  ) {
    const { error } = await supabase.from("tips").insert({
      merchant_id,
      booking_id: booking_id && UUID_RE.test(booking_id) ? booking_id : null,
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
