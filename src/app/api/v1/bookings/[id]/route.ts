import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { bookingLog, securityLog } from "@/lib/logger";
import { updateBookingSchema } from "@/lib/validations/booking";
import { apiError } from "@/lib/api-error";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * PATCH /api/v1/bookings/:id — Update booking status/time/practitioner
 * Uses optimistic locking via `version` column.
 * Returns 409 if version mismatch (concurrent modification).
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  const traceId = request.headers.get("x-trace-id") ?? undefined;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return apiError("Unauthorized", 401, { traceId });
  }

  // Verify merchant ownership (defense-in-depth, RLS also enforces this)
  const { data: merchant } = await supabase
    .from("merchants")
    .select("id")
    .eq("user_id", user.id)
    .single();

  if (!merchant) {
    return apiError("Merchant not found", 404, { traceId });
  }

  // Verify booking belongs to this merchant
  const { data: existingBooking } = await supabase
    .from("bookings")
    .select("id, merchant_id")
    .eq("id", id)
    .single();

  if (!existingBooking || existingBooking.merchant_id !== merchant.id) {
    securityLog.crossTenantBlocked("booking", merchant.id, traceId);
    return apiError("Booking not found", 404, { traceId });
  }

  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return apiError("Invalid JSON body", 400, { traceId });
  }

  const parsed = updateBookingSchema.safeParse(rawBody);
  if (!parsed.success) {
    return apiError("Validation failed", 422, {
      traceId,
      code: "VALIDATION_ERROR",
      details: parsed.error.flatten().fieldErrors as Record<string, unknown>,
    });
  }

  const { version, ...fields } = parsed.data;

  const sanitized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(fields)) {
    if (value !== undefined) {
      sanitized[key] = value;
    }
  }

  // Handle cancellation timestamps
  if (sanitized.status === "cancelled") {
    sanitized.cancelled_at = new Date().toISOString();
    sanitized.cancelled_by = sanitized.cancelled_by ?? "merchant";
  }

  // Optimistic locking: update only if current version matches
  const { data, error } = await supabase
    .from("bookings")
    .update({ ...sanitized, version: version + 1 })
    .eq("id", id)
    .eq("version", version)
    .select("*")
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      bookingLog.versionConflict(id, traceId);
      return apiError("Booking was modified by another user", 409, {
        code: "VERSION_CONFLICT",
        traceId,
      });
    }
    bookingLog.cancelled(id, error.message, traceId);
    return apiError("Failed to update booking", 400, { traceId });
  }

  if (!data) {
    bookingLog.versionConflict(id, traceId);
    return apiError("Booking not found or version conflict", 409, {
      code: "VERSION_CONFLICT",
      traceId,
    });
  }

  if (sanitized.status === "cancelled") {
    bookingLog.cancelled(id, sanitized.cancelled_by as string, traceId);
  }

  return NextResponse.json(data);
}
