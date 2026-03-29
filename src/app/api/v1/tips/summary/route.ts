import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { apiError } from "@/lib/api-error";
import { logger } from "@/lib/logger";

/**
 * GET /api/v1/tips/summary — Agrégation des pourboires par praticien
 * Query params: from, to (ISO dates). Defaults to current month.
 */
export async function GET(request: NextRequest) {
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
    .select("id")
    .eq("user_id", user.id)
    .single();

  if (!merchant) {
    return apiError("Merchant not found", 404, { traceId });
  }

  const { searchParams } = new URL(request.url);
  const now = new Date();
  const from =
    searchParams.get("from") ??
    new Date(Date.UTC(now.getFullYear(), now.getMonth(), 1)).toISOString();
  const to = searchParams.get("to") ?? now.toISOString();

  // Fetch tips in range
  const { data: tips, error } = await supabase
    .from("tips")
    .select("practitioner_id, amount_cents")
    .eq("merchant_id", merchant.id)
    .gte("created_at", from)
    .lte("created_at", to);

  if (error) {
    logger.error("tips.summary_failed", { error: error.message, traceId });
    return apiError("Failed to fetch tips summary", 500, { traceId });
  }

  // Fetch practitioners for names
  const { data: practitioners } = await supabase
    .from("practitioners")
    .select("id, name, color")
    .eq("merchant_id", merchant.id);

  // Aggregate by practitioner
  const byPrac = new Map<string, { total_cents: number; tip_count: number }>();
  let grandTotal = 0;

  for (const tip of tips ?? []) {
    const existing = byPrac.get(tip.practitioner_id) ?? { total_cents: 0, tip_count: 0 };
    existing.total_cents += tip.amount_cents;
    existing.tip_count += 1;
    grandTotal += tip.amount_cents;
    byPrac.set(tip.practitioner_id, existing);
  }

  const pracMap = new Map((practitioners ?? []).map((p) => [p.id, p]));

  const summary = Array.from(byPrac.entries()).map(([pracId, stats]) => {
    const prac = pracMap.get(pracId);
    return {
      practitioner_id: pracId,
      practitioner_name: prac?.name ?? "Inconnu",
      practitioner_color: prac?.color ?? "#888",
      total_cents: stats.total_cents,
      tip_count: stats.tip_count,
      average_cents: stats.tip_count > 0 ? Math.round(stats.total_cents / stats.tip_count) : 0,
    };
  });

  // Sort by total descending
  summary.sort((a, b) => b.total_cents - a.total_cents);

  return NextResponse.json({
    from,
    to,
    grand_total_cents: grandTotal,
    total_tips: (tips ?? []).length,
    by_practitioner: summary,
  });
}
