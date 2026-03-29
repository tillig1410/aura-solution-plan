import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { apiError } from "@/lib/api-error";
import { logger, securityLog } from "@/lib/logger";
import type { Database } from "@/types/supabase";

type PractitionerAvailabilityRow =
  Database["public"]["Tables"]["practitioner_availability"]["Row"];
type PractitionerAvailabilityInsert =
  Database["public"]["Tables"]["practitioner_availability"]["Insert"];

interface AvailabilityResponse {
  recurring: PractitionerAvailabilityRow[];
  exceptions: PractitionerAvailabilityRow[];
}

const availabilitySlotSchema = z.object({
  day_of_week: z
    .number()
    .int()
    .min(0, "day_of_week doit être entre 0 (Lundi) et 6 (Dimanche)")
    .max(6, "day_of_week doit être entre 0 (Lundi) et 6 (Dimanche)"),
  start_time: z
    .string()
    .regex(/^\d{2}:\d{2}(:\d{2})?$/, "start_time doit être au format HH:MM ou HH:MM:SS"),
  end_time: z
    .string()
    .regex(/^\d{2}:\d{2}(:\d{2})?$/, "end_time doit être au format HH:MM ou HH:MM:SS"),
  is_available: z.boolean(),
});

const exceptionSlotSchema = z.object({
  exception_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "exception_date doit être au format YYYY-MM-DD"),
  start_time: z
    .string()
    .regex(/^\d{2}:\d{2}(:\d{2})?$/, "start_time doit être au format HH:MM ou HH:MM:SS"),
  end_time: z
    .string()
    .regex(/^\d{2}:\d{2}(:\d{2})?$/, "end_time doit être au format HH:MM ou HH:MM:SS"),
  is_available: z.boolean(),
});

const putAvailabilitySchema = z
  .object({
    recurring: z.array(availabilitySlotSchema).optional(),
    exceptions: z.array(exceptionSlotSchema).optional(),
  })
  .refine((data) => data.recurring !== undefined || data.exceptions !== undefined, {
    message: "Au moins 'recurring' ou 'exceptions' doit être fourni",
  });

function splitAvailability(rows: PractitionerAvailabilityRow[]): AvailabilityResponse {
  return {
    recurring: rows.filter((r) => r.exception_date === null),
    exceptions: rows.filter((r) => r.exception_date !== null),
  };
}

/**
 * GET /api/v1/practitioners/:id/availability
 * Retourne les disponibilités séparées en recurring et exceptions
 */
export async function GET(
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
  const { data: practitioner, error: practitionerError } = await supabase
    .from("practitioners")
    .select("id")
    .eq("id", id)
    .eq("merchant_id", merchant.id)
    .single();

  if (practitionerError || !practitioner) {
    securityLog.crossTenantBlocked("practitioner", merchant.id, traceId);
    return apiError("Practitioner not found", 404, { traceId });
  }

  const { data: availability, error } = await supabase
    .from("practitioner_availability")
    .select("*")
    .eq("practitioner_id", id)
    .eq("merchant_id", merchant.id)
    .order("day_of_week", { ascending: true, nullsFirst: false });

  if (error) {
    logger.error("practitioners.availability_fetch_failed", {
      error: error.message,
      practitionerId: id,
      traceId,
    });
    return apiError("Failed to fetch availability", 500, { traceId });
  }

  return NextResponse.json(splitAvailability(availability ?? []));
}

/**
 * PUT /api/v1/practitioners/:id/availability
 * Remplace les disponibilités (recurring et/ou exceptions) du praticien
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
  const { data: practitioner, error: practitionerError } = await supabase
    .from("practitioners")
    .select("id")
    .eq("id", id)
    .eq("merchant_id", merchant.id)
    .single();

  if (practitionerError || !practitioner) {
    securityLog.crossTenantBlocked("practitioner", merchant.id, traceId);
    return apiError("Practitioner not found", 404, { traceId });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiError("Invalid JSON body", 400, { traceId });
  }

  const parsed = putAvailabilitySchema.safeParse(body);
  if (!parsed.success) {
    return apiError("Validation failed", 400, {
      traceId,
      details: parsed.error.flatten().fieldErrors as Record<string, unknown>,
    });
  }

  const { recurring, exceptions } = parsed.data;

  // Traiter recurring: DELETE + INSERT
  if (recurring !== undefined) {
    const { error: deleteError } = await supabase
      .from("practitioner_availability")
      .delete()
      .eq("practitioner_id", id)
      .eq("merchant_id", merchant.id)
      .not("day_of_week", "is", null);

    if (deleteError) {
      logger.error("practitioners.availability_delete_recurring_failed", {
        error: deleteError.message,
        practitionerId: id,
        traceId,
      });
      return apiError("Failed to update recurring availability", 500, { traceId });
    }

    if (recurring.length > 0) {
      const inserts: PractitionerAvailabilityInsert[] = recurring.map((slot) => ({
        merchant_id: merchant.id,
        practitioner_id: id,
        day_of_week: slot.day_of_week,
        start_time: slot.start_time,
        end_time: slot.end_time,
        is_available: slot.is_available,
        exception_date: null,
      }));

      const { error: insertError } = await supabase
        .from("practitioner_availability")
        .insert(inserts);

      if (insertError) {
        logger.error("practitioners.availability_insert_recurring_failed", {
          error: insertError.message,
          practitionerId: id,
          traceId,
        });
        return apiError("Failed to insert recurring availability", 500, { traceId });
      }
    }
  }

  // Traiter exceptions: DELETE + INSERT
  if (exceptions !== undefined) {
    const { error: deleteError } = await supabase
      .from("practitioner_availability")
      .delete()
      .eq("practitioner_id", id)
      .eq("merchant_id", merchant.id)
      .not("exception_date", "is", null);

    if (deleteError) {
      logger.error("practitioners.availability_delete_exceptions_failed", {
        error: deleteError.message,
        practitionerId: id,
        traceId,
      });
      return apiError("Failed to update exception availability", 500, { traceId });
    }

    if (exceptions.length > 0) {
      const inserts: PractitionerAvailabilityInsert[] = exceptions.map((slot) => ({
        merchant_id: merchant.id,
        practitioner_id: id,
        day_of_week: null,
        start_time: slot.start_time,
        end_time: slot.end_time,
        is_available: slot.is_available,
        exception_date: slot.exception_date,
      }));

      const { error: insertError } = await supabase
        .from("practitioner_availability")
        .insert(inserts);

      if (insertError) {
        logger.error("practitioners.availability_insert_exceptions_failed", {
          error: insertError.message,
          practitionerId: id,
          traceId,
        });
        return apiError("Failed to insert exception availability", 500, { traceId });
      }
    }
  }

  logger.info("practitioners.availability_updated", {
    practitionerId: id,
    merchantId: merchant.id,
    recurringCount: recurring?.length ?? 0,
    exceptionsCount: exceptions?.length ?? 0,
    traceId,
  });

  // Relire les données à jour
  const { data: updated, error: fetchError } = await supabase
    .from("practitioner_availability")
    .select("*")
    .eq("practitioner_id", id)
    .eq("merchant_id", merchant.id)
    .order("day_of_week", { ascending: true, nullsFirst: false });

  if (fetchError) {
    logger.error("practitioners.availability_refetch_failed", {
      error: fetchError.message,
      practitionerId: id,
      traceId,
    });
    return apiError("Availability updated but failed to fetch result", 500, { traceId });
  }

  return NextResponse.json(splitAvailability(updated ?? []));
}
