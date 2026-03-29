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

  // Valider que gold_threshold > silver_threshold si les deux sont fournis
  if (parsed.data.silver_threshold && parsed.data.gold_threshold) {
    if (parsed.data.gold_threshold <= parsed.data.silver_threshold) {
      return apiError("gold_threshold doit être supérieur à silver_threshold", 400, { traceId });
    }
  }

  // Upsert : créer si inexistant, mettre à jour sinon
  const { data: existing } = await supabase
    .from("loyalty_programs")
    .select("id")
    .eq("merchant_id", merchant.id)
    .single();

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
