import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { apiError } from "@/lib/api-error";
import { logger } from "@/lib/logger";

const createPackageSchema = z.object({
  name: z.string().min(2, "Le nom doit contenir au moins 2 caractères"),
  service_id: z.string().uuid("service_id invalide"),
  total_uses: z.number().int().min(1, "Minimum 1 utilisation"),
  price_cents: z.number().int().min(0, "Le prix ne peut pas être négatif"),
  validity_days: z.number().int().min(1).nullable().optional(),
});

/**
 * GET /api/v1/packages — Liste des forfaits du commerçant
 * Query params: include_inactive (bool)
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
  const includeInactive = searchParams.get("include_inactive") === "true";

  let query = supabase
    .from("packages")
    .select("*, service:services(id, name)")
    .eq("merchant_id", merchant.id)
    .order("created_at", { ascending: false });

  if (!includeInactive) {
    query = query.eq("is_active", true);
  }

  const { data: packages, error } = await query;

  if (error) {
    logger.error("packages.list_failed", { error: error.message, traceId });
    return apiError("Failed to fetch packages", 500, { traceId });
  }

  return NextResponse.json({ data: packages ?? [] });
}

/**
 * POST /api/v1/packages — Créer un forfait
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

  const parsed = createPackageSchema.safeParse(body);
  if (!parsed.success) {
    return apiError("Validation failed", 400, {
      traceId,
      details: parsed.error.flatten().fieldErrors as Record<string, unknown>,
    });
  }

  // Vérifier que le service appartient au commerçant
  const { data: service } = await supabase
    .from("services")
    .select("id")
    .eq("id", parsed.data.service_id)
    .eq("merchant_id", merchant.id)
    .single();

  if (!service) {
    return apiError("Service not found", 404, { traceId });
  }

  const { data: created, error } = await supabase
    .from("packages")
    .insert({
      merchant_id: merchant.id,
      name: parsed.data.name,
      service_id: parsed.data.service_id,
      total_uses: parsed.data.total_uses,
      price_cents: parsed.data.price_cents,
      validity_days: parsed.data.validity_days ?? null,
    })
    .select()
    .single();

  if (error) {
    logger.error("packages.create_failed", { error: error.message, traceId });
    return apiError("Failed to create package", 500, { traceId });
  }

  logger.info("packages.created", { packageId: created.id, merchantId: merchant.id, traceId });

  return NextResponse.json({ data: created }, { status: 201 });
}
