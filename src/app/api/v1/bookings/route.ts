import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { InsertDto } from "@/types/supabase";
import { bookingLog, logger, securityLog } from "@/lib/logger";
import { createBookingSchema } from "@/lib/validations/booking";
import { apiError } from "@/lib/api-error";

/**
 * POST /api/v1/bookings — Create a booking
 * Uses optimistic locking via unique index on (merchant_id, practitioner_id, starts_at)
 * Returns 409 if the slot is already taken.
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

  // Get merchant
  const { data: merchant } = await supabase
    .from("merchants")
    .select("id")
    .eq("user_id", user.id)
    .single();

  if (!merchant) {
    return apiError("Merchant not found", 404, { traceId });
  }

  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return apiError("Invalid JSON body", 400, { traceId });
  }

  const parsed = createBookingSchema.safeParse(rawBody);
  if (!parsed.success) {
    return apiError("Validation failed", 422, {
      traceId,
      code: "VALIDATION_ERROR",
      details: parsed.error.flatten().fieldErrors as Record<string, unknown>,
    });
  }
  const body = parsed.data;

  // M3: Verify all FK references belong to this merchant (prevent cross-tenant linking)
  const [clientCheck, practitionerCheck, serviceCheck] = await Promise.all([
    supabase
      .from("clients")
      .select("id")
      .eq("id", body.client_id)
      .eq("merchant_id", merchant.id)
      .single(),
    supabase
      .from("practitioners")
      .select("id")
      .eq("id", body.practitioner_id)
      .eq("merchant_id", merchant.id)
      .single(),
    supabase
      .from("services")
      .select("id")
      .eq("id", body.service_id)
      .eq("merchant_id", merchant.id)
      .single(),
  ]);

  if (!clientCheck.data) {
    securityLog.crossTenantBlocked("client", merchant.id, traceId);
    return apiError("Client not found for this merchant", 422, { traceId });
  }
  if (!practitionerCheck.data) {
    securityLog.crossTenantBlocked("practitioner", merchant.id, traceId);
    return apiError("Practitioner not found for this merchant", 422, { traceId });
  }
  if (!serviceCheck.data) {
    securityLog.crossTenantBlocked("service", merchant.id, traceId);
    return apiError("Service not found for this merchant", 422, { traceId });
  }

  const booking: InsertDto<"bookings"> = {
    merchant_id: merchant.id,
    client_id: body.client_id,
    practitioner_id: body.practitioner_id,
    service_id: body.service_id,
    starts_at: body.starts_at,
    ends_at: body.ends_at,
    status: "pending",
    source_channel: body.source_channel,
  };

  const { data, error } = await supabase
    .from("bookings")
    .insert(booking)
    .select("*")
    .single();

  if (error) {
    // Unique constraint violation → slot conflict
    if (error.code === "23505") {
      bookingLog.slotConflict(merchant.id, body.practitioner_id, body.starts_at, traceId);
      return apiError("Slot already taken", 409, { code: "SLOT_CONFLICT", traceId });
    }
    logger.error("booking.insert_failed", { error: error.message, traceId });
    return apiError("Failed to create booking", 400, { traceId });
  }

  bookingLog.created(data.id, merchant.id, traceId);
  return NextResponse.json(data, { status: 201 });
}
