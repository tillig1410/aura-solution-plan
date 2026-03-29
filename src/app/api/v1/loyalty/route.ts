import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { apiError } from "@/lib/api-error";
import { logger } from "@/lib/logger";

const updateLoyaltySchema = z.object({
  points_per_visit: z.number().int().min(0).optional(),
  points_per_euro: z.number().int().min(0).optional(),
  silver_threshold: z.number().int().min(1).optional(),
  gold_threshold: z.number().int().min(1).optional(),
  is_active: z.boolean().optional(),
});

/**
 * GET /api/v1/loyalty — Configuration du programme de fidélité
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

  const { data: program } = await supabase
    .from("loyalty_programs")
    .select("*")
    .eq("merchant_id", merchant.id)
    .single();

  return NextResponse.json({ data: program });
}

/**
 * PUT /api/v1/loyalty — Créer ou mettre à jour le programme de fidélité
 */
export async function PUT(request: NextRequest) {
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

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiError("Invalid JSON body", 400, { traceId });
  }

  const parsed = updateLoyaltySchema.safeParse(body);
  if (!parsed.success) {
    return apiError("Validation failed", 400, {
      traceId,
      details: parsed.error.flatten().fieldErrors as Record<string, unknown>,
    });
  }

  // Fetch existing program BEFORE validation (need current thresholds for partial updates)
  const { data: existing } = await supabase
    .from("loyalty_programs")
    .select("id, silver_threshold, gold_threshold")
    .eq("merchant_id", merchant.id)
    .single();

  // Merge submitted values with existing ones for cross-field validation
  const effectiveSilver = parsed.data.silver_threshold ?? existing?.silver_threshold;
  const effectiveGold = parsed.data.gold_threshold ?? existing?.gold_threshold;

  if (effectiveSilver != null && effectiveGold != null) {
    if (effectiveGold <= effectiveSilver) {
      return apiError("gold_threshold doit être supérieur à silver_threshold", 400, { traceId });
    }
  }

  if (existing) {
    const { data: updated, error } = await supabase
      .from("loyalty_programs")
      .update(parsed.data)
      .eq("merchant_id", merchant.id)
      .select()
      .single();

    if (error) {
      logger.error("loyalty.update_failed", { error: error.message, traceId });
      return apiError("Failed to update loyalty program", 500, { traceId });
    }

    return NextResponse.json({ data: updated });
  }

  // Créer un nouveau programme
  const { data: created, error } = await supabase
    .from("loyalty_programs")
    .insert({
      merchant_id: merchant.id,
      ...parsed.data,
    })
    .select()
    .single();

  if (error) {
    logger.error("loyalty.create_failed", { error: error.message, traceId });
    return apiError("Failed to create loyalty program", 500, { traceId });
  }

  logger.info("loyalty.created", { merchantId: merchant.id, traceId });

  return NextResponse.json({ data: created }, { status: 201 });
}
