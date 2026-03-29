import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { bookingLog, logger, securityLog } from "@/lib/logger";
import { updateBookingSchema } from "@/lib/validations/booking";
import { apiError } from "@/lib/api-error";
import { sendMessage } from "@/lib/channels/send";
import type { MessageChannel } from "@/types/supabase";

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

  // Verify booking belongs to this merchant (also fetch fields needed for notification)
  const { data: existingBooking } = await supabase
    .from("bookings")
    .select("id, merchant_id, client_id, practitioner_id, service_id, starts_at, ends_at, status")
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

  // T051b: Send client notification on cancellation or rescheduling
  const shouldNotify =
    sanitized.status === "cancelled" ||
    (sanitized.starts_at !== undefined &&
      existingBooking.starts_at !== sanitized.starts_at);

  if (shouldNotify) {
    void notifyClient({
      merchantId: merchant.id,
      clientId: existingBooking.client_id,
      booking: data,
      isCancelled: sanitized.status === "cancelled",
      traceId,
    });
  }

  return NextResponse.json(data);
}

// ---------------------------------------------------------------------------
// Internal: fire-and-forget client notification
// ---------------------------------------------------------------------------

interface NotifyClientParams {
  merchantId: string;
  clientId: string;
  booking: {
    id: string;
    starts_at: string;
    service_id: string;
  };
  isCancelled: boolean;
  traceId?: string;
}

async function notifyClient(params: NotifyClientParams): Promise<void> {
  const { merchantId, clientId, booking, isCancelled, traceId } = params;

  try {
    const supabase = await createClient();

    // Get client channel identifiers
    const { data: client } = await supabase
      .from("clients")
      .select("name, phone, whatsapp_id, messenger_id, telegram_id")
      .eq("id", clientId)
      .eq("merchant_id", merchantId)
      .single();

    if (!client) return;

    // Determine the best channel and recipient id
    let channel: MessageChannel | null = null;
    let recipientId: string | null = null;

    if (client.whatsapp_id) {
      channel = "whatsapp";
      recipientId = client.whatsapp_id;
    } else if (client.messenger_id) {
      channel = "messenger";
      recipientId = client.messenger_id;
    } else if (client.telegram_id) {
      channel = "telegram";
      recipientId = client.telegram_id;
    } else if (client.phone) {
      channel = "sms";
      recipientId = client.phone;
    }

    if (!channel || !recipientId) return;

    // Fetch service name for the message
    const { data: service } = await supabase
      .from("services")
      .select("name")
      .eq("id", booking.service_id)
      .eq("merchant_id", merchantId)
      .single();

    const clientName = client.name ?? "Client";
    const serviceName = service?.name ?? "votre prestation";
    const dateLabel = new Date(booking.starts_at).toLocaleString("fr-FR", {
      weekday: "long",
      day: "numeric",
      month: "long",
      hour: "2-digit",
      minute: "2-digit",
    });

    const message = isCancelled
      ? `Bonjour ${clientName}, votre rendez-vous "${serviceName}" a été annulé. N'hésitez pas à reprendre contact pour en planifier un nouveau.`
      : `Bonjour ${clientName}, votre rendez-vous "${serviceName}" a été modifié et est maintenant prévu le ${dateLabel}.`;

    await sendMessage({ channel, recipientId, message, merchantId });

    logger.info("booking.client_notified", {
      bookingId: booking.id,
      channel,
      isCancelled,
      traceId,
    });
  } catch (err) {
    logger.error("booking.notification_failed", {
      bookingId: booking.id,
      error: err instanceof Error ? err.message : String(err),
      traceId,
    });
  }
}
