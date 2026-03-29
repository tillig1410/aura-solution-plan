import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { InsertDto } from "@/types/supabase";
import { bookingLog, logger, securityLog } from "@/lib/logger";
import { createBookingSchema } from "@/lib/validations/booking";
import { apiError } from "@/lib/api-error";

const VALID_STATUSES = ["pending", "confirmed", "in_progress", "completed", "cancelled", "no_show"] as const;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const MONTH_RE = /^\d{4}-\d{2}$/;

/**
 * GET /api/v1/bookings — List bookings with optional filters
 * Query params:
 *   date        — ISO date (YYYY-MM-DD) — filter by day
 *   week_start  — ISO date (YYYY-MM-DD) — filter Mon–Sun week
 *   month       — YYYY-MM — filter by calendar month
 *   practitioner_id — UUID — filter by practitioner
 *   status      — booking status enum
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
  const date = searchParams.get("date");
  const weekStart = searchParams.get("week_start");
  const month = searchParams.get("month");
  const practitionerId = searchParams.get("practitioner_id");
  const status = searchParams.get("status");

  // Validate inputs
  if (date && !DATE_RE.test(date)) {
    return apiError("Invalid date format, expected YYYY-MM-DD", 400, { traceId });
  }
  if (weekStart && !DATE_RE.test(weekStart)) {
    return apiError("Invalid week_start format, expected YYYY-MM-DD", 400, { traceId });
  }
  if (month && !MONTH_RE.test(month)) {
    return apiError("Invalid month format, expected YYYY-MM", 400, { traceId });
  }
  if (status && !(VALID_STATUSES as readonly string[]).includes(status)) {
    return apiError("Invalid status value", 400, { traceId });
  }

  let query = supabase
    .from("bookings")
    .select(
      `
      *,
      client:clients(id, name, phone, preferred_language),
      practitioner:practitioners(id, name, color),
      service:services(id, name, duration_minutes, price_cents)
      `,
    )
    .eq("merchant_id", merchant.id)
    .order("starts_at", { ascending: true });

  if (date) {
    query = query
      .gte("starts_at", `${date}T00:00:00`)
      .lte("starts_at", `${date}T23:59:59`);
  } else if (weekStart) {
    // Manipulation purement UTC pour éviter les décalages DST :
    // on n'utilise que la partie date, jamais de conversion timezone implicite.
    const [wy, wm, wd] = weekStart.split("-").map(Number);
    const endDate = new Date(Date.UTC(wy, wm - 1, wd + 6));
    const endStr = endDate.toISOString().slice(0, 10);
    query = query
      .gte("starts_at", `${weekStart}T00:00:00`)
      .lte("starts_at", `${endStr}T23:59:59`);
  } else if (month) {
    const [year, mon] = month.split("-").map(Number);
    const firstDay = `${month}-01`;
    const lastDay = new Date(year, mon, 0).getDate();
    const lastDayStr = `${month}-${String(lastDay).padStart(2, "0")}`;
    query = query
      .gte("starts_at", `${firstDay}T00:00:00`)
      .lte("starts_at", `${lastDayStr}T23:59:59`);
  }

  if (practitionerId) {
    query = query.eq("practitioner_id", practitionerId);
  }

  if (status) {
    query = query.eq("status", status as "pending" | "confirmed" | "in_progress" | "completed" | "cancelled" | "no_show");
  }

  const { data, error } = await query;

  if (error) {
    logger.error("bookings.list_failed", { error: error.message, traceId });
    return apiError("Failed to fetch bookings", 500, { traceId });
  }

  return NextResponse.json(data ?? []);
}

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
