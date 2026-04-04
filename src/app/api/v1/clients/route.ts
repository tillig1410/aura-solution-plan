import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { apiError } from "@/lib/api-error";
import { logger } from "@/lib/logger";
import type { Database } from "@/types/supabase";

type ClientRow = Database["public"]["Tables"]["clients"]["Row"];

export interface ClientWithStats extends ClientRow {
  booking_count: number;
  last_booking_at: string | null;
}

const createClientSchema = z.object({
  name: z.string().min(2, "Le nom doit contenir au moins 2 caractères").max(255),
  phone: z.string().max(30).optional(),
  email: z.string().email("Email invalide").max(320).optional().or(z.literal("")),
  notes: z.string().max(5000).optional(),
});

const VALID_FILTERS = ["all", "loyal", "new", "inactive"] as const;
type ClientFilter = (typeof VALID_FILTERS)[number];

/**
 * GET /api/v1/clients — Liste paginée des clients avec stats
 * Query params: search, page (default 1), limit (default 20), filter (all|loyal|new|inactive)
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
  const search = searchParams.get("search") ?? "";
  const pageRaw = parseInt(searchParams.get("page") ?? "1", 10);
  const limitRaw = parseInt(searchParams.get("limit") ?? "20", 10);
  const filter = (searchParams.get("filter") ?? "all") as ClientFilter;

  const page = isNaN(pageRaw) || pageRaw < 1 ? 1 : pageRaw;
  const limit = isNaN(limitRaw) || limitRaw < 1 || limitRaw > 100 ? 20 : limitRaw;

  if (!(VALID_FILTERS as readonly string[]).includes(filter)) {
    return apiError("Invalid filter value", 400, { traceId });
  }

  const offset = (page - 1) * limit;

  let query = supabase
    .from("clients")
    .select("*", { count: "exact" })
    .eq("merchant_id", merchant.id)
    .order("created_at", { ascending: false });

  if (search.length > 0) {
    // Escape PostgREST filter metacharacters to prevent injection
    const safe = search.replace(/[%_\\.,()]/g, "");
    if (safe.length > 0) {
      query = query.or(`name.ilike.%${safe}%,phone.ilike.%${safe}%`);
    }
  }

  if (filter === "loyal") {
    query = query.in("loyalty_tier", ["gold", "silver"]);
  } else if (filter === "new") {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    query = query.gte("created_at", thirtyDaysAgo.toISOString());
  } else if (filter === "inactive") {
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
    query = query.lt("updated_at", ninetyDaysAgo.toISOString());
  }

  query = query.range(offset, offset + limit - 1);

  const { data: clients, error, count } = await query;

  if (error) {
    logger.error("clients.list_failed", { error: error.message, traceId });
    return apiError("Failed to fetch clients", 500, { traceId });
  }

  if (!clients || clients.length === 0) {
    return NextResponse.json({
      data: [] as ClientWithStats[],
      count: 0,
      page,
      total_pages: 0,
    });
  }

  const clientIds = clients.map((c) => c.id);

  const { data: bookingStats, error: statsError } = await supabase
    .from("bookings")
    .select("client_id, starts_at")
    .eq("merchant_id", merchant.id)
    .in("client_id", clientIds)
    .not("status", "in", '("cancelled","no_show")');

  if (statsError) {
    logger.error("clients.stats_failed", { error: statsError.message, traceId });
  }

  const statsMap = new Map<string, { booking_count: number; last_booking_at: string | null }>();
  for (const clientId of clientIds) {
    statsMap.set(clientId, { booking_count: 0, last_booking_at: null });
  }

  if (bookingStats) {
    for (const b of bookingStats) {
      const existing = statsMap.get(b.client_id);
      if (!existing) continue;
      existing.booking_count += 1;
      if (!existing.last_booking_at || b.starts_at > existing.last_booking_at) {
        existing.last_booking_at = b.starts_at;
      }
    }
  }

  const data: ClientWithStats[] = clients.map((c) => {
    const stats = statsMap.get(c.id) ?? { booking_count: 0, last_booking_at: null };
    return { ...c, ...stats };
  });

  const total = count ?? 0;
  const total_pages = Math.ceil(total / limit);

  return NextResponse.json({ data, count: total, page, total_pages });
}

/**
 * POST /api/v1/clients — Créer un nouveau client manuellement
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

  const { data: merchant } = await supabase
    .from("merchants")
    .select("id")
    .eq("user_id", user.id)
    .single();

  if (!merchant) {
    return apiError("Merchant not found", 404, { traceId });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiError("Invalid JSON body", 400, { traceId });
  }

  const parsed = createClientSchema.safeParse(body);
  if (!parsed.success) {
    return apiError("Validation failed", 400, {
      traceId,
      details: parsed.error.flatten().fieldErrors as Record<string, unknown>,
    });
  }

  const { name, phone, email, notes } = parsed.data;

  const { data: created, error } = await supabase
    .from("clients")
    .insert({
      merchant_id: merchant.id,
      name,
      phone: phone ?? null,
      email: email && email.length > 0 ? email : null,
      notes: notes ?? null,
    })
    .select()
    .single();

  if (error) {
    logger.error("clients.create_failed", { error: error.message, traceId });
    return apiError("Failed to create client", 500, { traceId });
  }

  logger.info("clients.created", { clientId: created.id, merchantId: merchant.id, traceId });

  return NextResponse.json(created, { status: 201 });
}
