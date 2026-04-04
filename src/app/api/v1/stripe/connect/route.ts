import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { apiError } from "@/lib/api-error";
import { logger } from "@/lib/logger";
import { createConnectAccount } from "@/lib/stripe/connect";

/**
 * POST /api/v1/stripe/connect — Initiate Stripe Connect onboarding
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
    .select("id, name, email, stripe_account_id")
    .eq("user_id", user.id)
    .single();

  if (!merchant) {
    return apiError("Merchant not found", 404, { traceId });
  }

  if (merchant.stripe_account_id) {
    return apiError("Stripe account already connected", 400, { traceId });
  }

  try {
    const { accountId, onboardingUrl } = await createConnectAccount(
      merchant.email,
      merchant.name,
      merchant.id,
    );

    // Save the Stripe account ID
    await supabase
      .from("merchants")
      .update({ stripe_account_id: accountId })
      .eq("id", merchant.id);

    return NextResponse.json({ onboardingUrl });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    logger.error("stripe.connect_create_failed", { error: msg, traceId });
    return apiError("Failed to create Stripe account", 500, { traceId });
  }
}
