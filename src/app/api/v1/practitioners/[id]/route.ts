import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { apiError } from "@/lib/api-error";
import { logger, securityLog } from "@/lib/logger";

const updatePractitionerSchema = z
  .object({
    name: z.string().min(2, "Le nom doit contenir au moins 2 caractères").max(255).optional(),
    email: z.string().email("Email invalide").max(320).optional().nullable(),
    color: z
      .string()
      .regex(/^#[0-9a-fA-F]{6}$/, "La couleur doit être au format hexadécimal #RRGGBB")
      .optional(),
    specialties: z.array(z.string()).optional(),
    is_active: z.boolean().optional(),
    sort_order: z.number().int().min(0).optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field must be provided",
  });

/**
 * PATCH /api/v1/practitioners/:id — Mise à jour partielle d'un praticien
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

  // Vérifier que le praticien appartient au commerçant (cross-tenant check)
  const { data: existing, error: fetchError } = await supabase
    .from("practitioners")
    .select("id")
    .eq("id", id)
    .eq("merchant_id", merchant.id)
    .single();

  if (fetchError || !existing) {
    securityLog.crossTenantBlocked("practitioner", merchant.id, traceId);
    return apiError("Practitioner not found", 404, { traceId });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiError("Invalid JSON body", 400, { traceId });
  }

  const parsed = updatePractitionerSchema.safeParse(body);
  if (!parsed.success) {
    return apiError("Validation failed", 400, {
      traceId,
      details: parsed.error.flatten().fieldErrors as Record<string, unknown>,
    });
  }

  const { data: updated, error } = await supabase
    .from("practitioners")
    .update({ ...parsed.data, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("merchant_id", merchant.id)
    .select()
    .single();

  if (error) {
    logger.error("practitioners.update_failed", {
      error: error.message,
      practitionerId: id,
      traceId,
    });
    return apiError("Failed to update practitioner", 500, { traceId });
  }

  logger.info("practitioners.updated", { practitionerId: id, merchantId: merchant.id, traceId });

  return NextResponse.json(updated);
}
