import { logger } from "@/lib/logger";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface ChargeLike {
  id: string;
  payment_intent: string | null;
  amount_refunded: number;
  refunded: boolean;
  metadata: Record<string, string> | null;
}

interface DisputeLike {
  id: string;
  charge: string;
  amount: number;
  reason: string | null;
  status: string;
  metadata: Record<string, string> | null;
}

/**
 * Handle charge.refunded — log the refund and update the booking status if applicable.
 */
export async function handleChargeRefunded(
  charge: unknown,
  supabase: SupabaseClient<Database>,
): Promise<void> {
  const ch = charge as ChargeLike;
  const metadata = ch.metadata ?? {};
  const bookingId = metadata.booking_id;
  const merchantId = metadata.merchant_id;

  logger.info("stripe.charge_refunded", {
    chargeId: ch.id,
    paymentIntentId: ch.payment_intent,
    amountRefunded: ch.amount_refunded,
    fullRefund: ch.refunded,
  });

  if (bookingId && merchantId && UUID_RE.test(bookingId) && UUID_RE.test(merchantId)) {
    const { error } = await supabase
      .from("bookings")
      .update({ status: "cancelled" })
      .eq("id", bookingId)
      .eq("merchant_id", merchantId);

    if (error) {
      logger.error("stripe.refund_booking_update_failed", {
        chargeId: ch.id,
        bookingId,
        error: error.message,
      });
    }
  }
}

/**
 * Handle charge.dispute.created — log critical alert for chargeback.
 * The merchant needs to respond to the dispute in their Stripe dashboard.
 */
export async function handleChargeDisputeCreated(
  dispute: unknown,
  _supabase: SupabaseClient<Database>,
): Promise<void> {
  const d = dispute as DisputeLike;

  logger.error("stripe.dispute_created", {
    disputeId: d.id,
    chargeId: d.charge,
    amount: d.amount,
    reason: d.reason,
    status: d.status,
  });
}
