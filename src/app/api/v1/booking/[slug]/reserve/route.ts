import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/server";
import { apiError } from "@/lib/api-error";
import { logger } from "@/lib/logger";

const reserveSchema = z.object({
  client_name: z.string().min(1, "Le nom est requis").max(255),
  client_phone: z.string().min(6, "Le téléphone est requis").max(30),
  client_email: z.string().email().max(320).optional(),
  practitioner_id: z.string().uuid("practitioner_id invalide"),
  service_id: z.string().uuid("service_id invalide"),
  starts_at: z.string().datetime("starts_at doit être au format ISO 8601"),
});

/**
 * POST /api/v1/booking/:slug/reserve — Création réservation depuis le site public (non protégé)
 *
 * SECURITY: Uses createAdminClient (bypasses RLS) because this is a public route.
 * All writes are scoped to the merchant resolved from the slug.
 * DB constraints (unique indexes) provide defense-in-depth against race conditions.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const traceId = request.headers.get("x-trace-id") ?? undefined;

  // CSRF protection: reject cross-origin requests from unknown origins
  const origin = request.headers.get("origin");
  const rawAppUrl = process.env.NEXT_PUBLIC_APP_URL ?? process.env.VERCEL_URL;
  if (origin) {
    if (!rawAppUrl) {
      // Misconfiguration: app URL unknown — log and continue (public endpoint)
      logger.warn("booking.csrf_check_skipped_no_app_url", { traceId, origin });
    } else {
      const allowedOrigin = rawAppUrl.startsWith("http") ? rawAppUrl : `https://${rawAppUrl}`;
      try {
        if (new URL(origin).origin !== new URL(allowedOrigin).origin) {
          return apiError("Forbidden", 403, { traceId, code: "CSRF_ORIGIN_MISMATCH" });
        }
      } catch {
        return apiError("Forbidden", 403, { traceId, code: "CSRF_ORIGIN_MISMATCH" });
      }
    }
  }

  const supabase = createAdminClient();

  // Charger le commerçant
  const { data: merchant } = await supabase
    .from("merchants")
    .select("id")
    .eq("slug", slug)
    .single();

  if (!merchant) {
    return apiError("Salon not found", 404, { traceId });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiError("Invalid JSON body", 400, { traceId });
  }

  const parsed = reserveSchema.safeParse(body);
  if (!parsed.success) {
    return apiError("Validation failed", 400, {
      traceId,
      details: parsed.error.flatten().fieldErrors as Record<string, unknown>,
    });
  }

  const { client_name, client_phone, client_email, practitioner_id, service_id, starts_at } =
    parsed.data;

  // Vérifier que le praticien et service appartiennent au commerçant
  const [{ data: practitioner }, { data: service }] = await Promise.all([
    supabase
      .from("practitioners")
      .select("id")
      .eq("id", practitioner_id)
      .eq("merchant_id", merchant.id)
      .eq("is_active", true)
      .single(),
    supabase
      .from("services")
      .select("id, duration_minutes")
      .eq("id", service_id)
      .eq("merchant_id", merchant.id)
      .eq("is_active", true)
      .single(),
  ]);

  if (!practitioner) {
    return apiError("Practitioner not found", 404, { traceId });
  }
  if (!service) {
    return apiError("Service not found", 404, { traceId });
  }

  // Trouver ou créer le client
  const { data: existingClient } = await supabase
    .from("clients")
    .select("id")
    .eq("merchant_id", merchant.id)
    .eq("phone", client_phone)
    .single();

  let clientId: string;

  if (existingClient) {
    clientId = existingClient.id;
  } else {
    const { data: newClient, error: clientError } = await supabase
      .from("clients")
      .insert({
        merchant_id: merchant.id,
        name: client_name,
        phone: client_phone,
        email: client_email ?? null,
      })
      .select("id")
      .single();

    if (clientError) {
      // Unique constraint violation = concurrent insert with same phone
      if (clientError.code === "23505") {
        const { data: raceClient } = await supabase
          .from("clients")
          .select("id")
          .eq("merchant_id", merchant.id)
          .eq("phone", client_phone)
          .single();
        if (raceClient) {
          clientId = raceClient.id;
        } else {
          return apiError("Failed to create client", 500, { traceId });
        }
      } else {
        logger.error("booking_page.client_create_failed", {
          error: clientError.message,
          traceId,
        });
        return apiError("Failed to create client", 500, { traceId });
      }
    } else if (!newClient) {
      return apiError("Failed to create client", 500, { traceId });
    } else {
      clientId = newClient.id;
    }
  }

  // Calculer ends_at
  const startsAtDate = new Date(starts_at);
  const endsAtDate = new Date(startsAtDate.getTime() + service.duration_minutes * 60 * 1000);

  // Vérifier que le créneau est libre (pas de chevauchement)
  const { data: conflicting } = await supabase
    .from("bookings")
    .select("id")
    .eq("merchant_id", merchant.id)
    .eq("practitioner_id", practitioner_id)
    .neq("status", "cancelled")
    .lt("starts_at", endsAtDate.toISOString())
    .gt("ends_at", starts_at)
    .limit(1);

  if (conflicting && conflicting.length > 0) {
    return apiError("Ce créneau n'est plus disponible", 409, { traceId, code: "SLOT_CONFLICT" });
  }

  // Créer la réservation
  const { data: booking, error: bookingError } = await supabase
    .from("bookings")
    .insert({
      merchant_id: merchant.id,
      client_id: clientId,
      practitioner_id,
      service_id,
      starts_at,
      ends_at: endsAtDate.toISOString(),
      status: "pending",
      source_channel: "booking_page",
    })
    .select("id, starts_at, ends_at, status")
    .single();

  if (bookingError) {
    // Unique constraint violation = double-booking race condition caught at DB level
    if (bookingError.code === "23505") {
      return apiError("Ce créneau n'est plus disponible", 409, { traceId, code: "SLOT_CONFLICT" });
    }
    logger.error("booking_page.create_failed", { error: bookingError.message, traceId });
    return apiError("Failed to create booking", 500, { traceId });
  }

  logger.info("booking_page.created", {
    bookingId: booking.id,
    merchantId: merchant.id,
    slug,
    traceId,
  });

  return NextResponse.json(
    {
      data: {
        id: booking.id,
        starts_at: booking.starts_at,
        ends_at: booking.ends_at,
        status: booking.status,
        message: "Votre rendez-vous a bien été enregistré. Vous recevrez une confirmation.",
      },
    },
    { status: 201 },
  );
}
