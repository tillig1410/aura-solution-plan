import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { apiError } from "@/lib/api-error";
import { logger, securityLog } from "@/lib/logger";
import type { Database } from "@/types/supabase";

type ServiceAssignmentInsert =
  Database["public"]["Tables"]["practitioner_services"]["Insert"];

const putServicesSchema = z.object({
  service_ids: z.array(z.string().uuid("Invalid service UUID")),
});

/**
 * PUT /api/v1/practitioners/:id/services — Remplace les services assignés au praticien
 * Body: { service_ids: string[] }
 * Stratégie : DELETE + INSERT (idempotent, list complète attendue)
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const traceId = request.headers.get("x-trace-id") ?? undefined;
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return apiError("Unauthorized", 401, { traceId });

  const { data: merchant } = await supabase
    .from("merchants")
    .select("id")
    .eq("user_id", user.id)
    .single();

  if (!merchant) return apiError("Merchant not found", 404, { traceId });

  // Cross-tenant check
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

  const parsed = putServicesSchema.safeParse(body);
  if (!parsed.success) {
    return apiError("Validation failed", 400, {
      traceId,
      details: parsed.error.flatten().fieldErrors as Record<string, unknown>,
    });
  }

  const { service_ids } = parsed.data;

  // Vérifier que tous les service_ids appartiennent au commerçant
  if (service_ids.length > 0) {
    const { data: services } = await supabase
      .from("services")
      .select("id")
      .eq("merchant_id", merchant.id)
      .in("id", service_ids);

    const foundIds = new Set((services ?? []).map((s) => s.id));
    const invalid = service_ids.filter((sid) => !foundIds.has(sid));
    if (invalid.length > 0) {
      return apiError("Some service_ids do not belong to this merchant", 400, { traceId });
    }
  }

  // Sauvegarder l'état actuel pour rollback best-effort
  const { data: backup } = await supabase
    .from("practitioner_services")
    .select("*")
    .eq("practitioner_id", id)
    .eq("merchant_id", merchant.id);

  // DELETE toutes les assignations existantes
  const { error: deleteError } = await supabase
    .from("practitioner_services")
    .delete()
    .eq("practitioner_id", id)
    .eq("merchant_id", merchant.id);

  if (deleteError) {
    logger.error("practitioners.services_delete_failed", {
      error: deleteError.message,
      practitionerId: id,
      traceId,
    });
    return apiError("Failed to update service assignments", 500, { traceId });
  }

  // INSERT nouvelles assignations
  if (service_ids.length > 0) {
    const inserts: ServiceAssignmentInsert[] = service_ids.map((serviceId) => ({
      merchant_id: merchant.id,
      practitioner_id: id,
      service_id: serviceId,
    }));

    const { error: insertError } = await supabase
      .from("practitioner_services")
      .insert(inserts);

    if (insertError) {
      logger.error("practitioners.services_insert_failed", {
        error: insertError.message,
        practitionerId: id,
        traceId,
      });

      // Best-effort rollback : practitioner_services n'a pas de colonne id (PK composite)
      if (backup && backup.length > 0) {
        await supabase.from("practitioner_services").insert(backup);
      }

      return apiError("Failed to assign services", 500, { traceId });
    }
  }

  logger.info("practitioners.services_updated", {
    practitionerId: id,
    merchantId: merchant.id,
    serviceCount: service_ids.length,
    traceId,
  });

  return NextResponse.json({ practitioner_id: id, service_ids });
}
