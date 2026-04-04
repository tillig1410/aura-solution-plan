import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { apiError } from "@/lib/api-error";
import { logger, securityLog } from "@/lib/logger";

const updateClientSchema = z
  .object({
    name: z.string().min(2).max(255).optional(),
    phone: z.string().max(30).optional().nullable(),
    email: z.string().email().max(320).optional().nullable(),
    notes: z.string().max(5000).optional().nullable(),
    is_blocked: z.boolean().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field must be provided",
  });

/**
 * GET /api/v1/clients/:id — Fiche complète du client avec historique
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

  const { data: client, error: clientError } = await supabase
    .from("clients")
    .select("id, merchant_id, name, phone, email, notes, is_blocked, loyalty_points, loyalty_tier, no_show_count, preferred_practitioner_id, preferred_service_id, created_at, updated_at")
    .eq("id", id)
    .eq("merchant_id", merchant.id)
    .single();

  if (clientError || !client) {
    if (clientError?.code === "PGRST116") {
      securityLog.crossTenantBlocked("client", merchant.id, traceId);
    }
    return apiError("Client not found", 404, { traceId });
  }

  const [
    { data: recentBookings, error: bookingsError },
    { data: activePackages, error: packagesError },
  ] = await Promise.all([
    supabase
      .from("bookings")
      .select(
        `
        id, starts_at, ends_at, status, source_channel,
        service:services(id, name, price_cents, duration_minutes),
        practitioner:practitioners(id, name, color)
        `,
      )
      .eq("client_id", id)
      .eq("merchant_id", merchant.id)
      .order("starts_at", { ascending: false })
      .limit(10),
    supabase
      .from("client_packages")
      .select(
        `
        id, remaining_uses, purchased_at, expires_at,
        package:packages(id, name, total_uses, price_cents)
        `,
      )
      .eq("client_id", id)
      .eq("merchant_id", merchant.id)
      .gt("remaining_uses", 0),
  ]);

  if (bookingsError) {
    logger.error("clients.bookings_fetch_failed", { error: bookingsError.message, traceId });
  }
  if (packagesError) {
    logger.error("clients.packages_fetch_failed", { error: packagesError.message, traceId });
  }

  return NextResponse.json({
    ...client,
    recent_bookings: recentBookings ?? [],
    active_packages: activePackages ?? [],
  });
}

/**
 * PATCH /api/v1/clients/:id — Mise à jour partielle du client
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

  // Vérifier que le client appartient au commerçant
  const { data: existing, error: fetchError } = await supabase
    .from("clients")
    .select("id")
    .eq("id", id)
    .eq("merchant_id", merchant.id)
    .single();

  if (fetchError || !existing) {
    securityLog.crossTenantBlocked("client", merchant.id, traceId);
    return apiError("Client not found", 404, { traceId });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiError("Invalid JSON body", 400, { traceId });
  }

  const parsed = updateClientSchema.safeParse(body);
  if (!parsed.success) {
    return apiError("Validation failed", 400, {
      traceId,
      details: parsed.error.flatten().fieldErrors as Record<string, unknown>,
    });
  }

  const { data: updated, error } = await supabase
    .from("clients")
    .update({ ...parsed.data, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("merchant_id", merchant.id)
    .select()
    .single();

  if (error) {
    logger.error("clients.update_failed", { error: error.message, clientId: id, traceId });
    return apiError("Failed to update client", 500, { traceId });
  }

  logger.info("clients.updated", { clientId: id, merchantId: merchant.id, traceId });

  return NextResponse.json(updated);
}
