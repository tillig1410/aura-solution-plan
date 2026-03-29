import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { apiError } from "@/lib/api-error";
import { createDashboardLink } from "@/lib/stripe/connect";

/**
 * POST /api/v1/stripe/dashboard-link — Generate Stripe dashboard login link
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
    .select("id, stripe_account_id")
    .eq("user_id", user.id)
    .single();

  if (!merchant) {
    return apiError("Merchant not found", 404, { traceId });
  }

  if (!merchant.stripe_account_id) {
    return apiError("No Stripe account connected", 400, { traceId });
  }

  try {
    const url = await createDashboardLink(merchant.stripe_account_id);
    return NextResponse.json({ url });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return apiError("Failed to create dashboard link: " + msg, 500, { traceId });
  }
}
