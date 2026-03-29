import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { apiError } from "@/lib/api-error";
import { logger, securityLog } from "@/lib/logger";

const updateServiceSchema = z
  .object({
    name: z.string().min(2, "Le nom doit contenir au moins 2 caractères").optional(),
    description: z.string().optional().nullable(),
    duration_minutes: z
      .number()
      .int("La durée doit être un entier")
      .min(5, "La durée minimale est 5 minutes")
      .max(480, "La durée maximale est 480 minutes")
      .optional(),
    price_cents: z
      .number()
      .int("Le prix doit être un entier")
      .min(0, "Le prix ne peut pas être négatif")
      .optional(),
    is_active: z.boolean().optional(),
    sort_order: z.number().int().min(0).optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field must be provided",
  });

/**
 * PATCH /api/v1/services/:id — Mise à jour partielle d'un service
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const traceId = request.headers.get("x-trace-id") ?? undefined;
  const { id } = await params;
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

  // Vérifier que le service appartient au commerçant (cross-tenant check)
  const { data: existing, error: fetchError } = await supabase
    .from("services")
    .select("id")
    .eq("id", id)
    .eq("merchant_id", merchant.id)
    .single();

  if (fetchError || !existing) {
    securityLog.crossTenantBlocked("service", merchant.id, traceId);
    return apiError("Service not found", 404, { traceId });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiError("Invalid JSON body", 400, { traceId });
  }

  const parsed = updateServiceSchema.safeParse(body);
  if (!parsed.success) {
    return apiError("Validation failed", 400, {
      traceId,
      details: parsed.error.flatten().fieldErrors as Record<string, unknown>,
    });
  }

  const { data: updated, error } = await supabase
    .from("services")
    .update({ ...parsed.data, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("merchant_id", merchant.id)
    .select()
    .single();

  if (error) {
    logger.error("services.update_failed", { error: error.message, serviceId: id, traceId });
    return apiError("Failed to update service", 500, { traceId });
  }

  logger.info("services.updated", { serviceId: id, merchantId: merchant.id, traceId });

  return NextResponse.json(updated);
}

/**
 * DELETE /api/v1/services/:id — Soft delete (is_active = false)
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const traceId = request.headers.get("x-trace-id") ?? undefined;
  const { id } = await params;
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

  // Vérifier que le service appartient au commerçant (cross-tenant check)
  const { data: existing, error: fetchError } = await supabase
    .from("services")
    .select("id")
    .eq("id", id)
    .eq("merchant_id", merchant.id)
    .single();

  if (fetchError || !existing) {
    securityLog.crossTenantBlocked("service", merchant.id, traceId);
    return apiError("Service not found", 404, { traceId });
  }

  const { error } = await supabase
    .from("services")
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("merchant_id", merchant.id);

  if (error) {
    logger.error("services.delete_failed", { error: error.message, serviceId: id, traceId });
    return apiError("Failed to delete service", 500, { traceId });
  }

  logger.info("services.deleted", { serviceId: id, merchantId: merchant.id, traceId });

  return NextResponse.json({ deleted: true, id });
}
