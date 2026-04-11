import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { apiError } from "@/lib/api-error";
import { logger } from "@/lib/logger";
import { getStripeClient } from "@/lib/stripe/client";

/**
 * POST /api/v1/stripe/customer-portal — Create a Stripe Customer Portal session.
 * Allows merchants to manage their Plan subscription (change plan, cancel, update payment method).
 */
export async function POST(request: NextRequest) {
  const traceId = request.headers.get("x-trace-id") ?? undefined;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return apiError("Unauthorized", 401, { traceId });
  }

  const { data: merchant } = await supabase
    .from("merchants")
    .select("id, stripe_subscription_id")
    .eq("user_id", user.id)
    .single();

  if (!merchant) {
    return apiError("Merchant not found", 404, { traceId });
  }

  if (!merchant.stripe_subscription_id) {
    return apiError("No active subscription", 400, { traceId });
  }

  try {
    const stripe = getStripeClient();
    // Retrieve the subscription to get the customer ID
    const subscription = await stripe.subscriptions.retrieve(merchant.stripe_subscription_id);

    const session = await stripe.billingPortal.sessions.create({
      customer: subscription.customer as string,
      return_url: `${process.env.NEXT_PUBLIC_APP_URL}/settings?tab=abonnement`,
    });

    return NextResponse.json({ url: session.url });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    logger.error("stripe.customer_portal_failed", { error: msg, traceId });
    return apiError("Failed to create portal session", 500, { traceId });
  }
}
