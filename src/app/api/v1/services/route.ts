import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { apiError } from "@/lib/api-error";
import { logger } from "@/lib/logger";
import type { Database } from "@/types/supabase";

type ServiceRow = Database["public"]["Tables"]["services"]["Row"];

export interface ServiceWithPractitioners extends ServiceRow {
  practitioner_ids: string[];
}

const createServiceSchema = z.object({
  name: z.string().min(2, "Le nom doit contenir au moins 2 caractères").max(255),
  duration_minutes: z
    .number()
    .int("La durée doit être un entier")
    .min(5, "La durée minimale est 5 minutes")
    .max(480, "La durée maximale est 480 minutes"),
  price_cents: z.number().int("Le prix doit être un entier").min(0, "Le prix ne peut pas être négatif"),
  description: z.string().max(2000).optional(),
  is_active: z.boolean().optional().default(true),
});

/**
 * GET /api/v1/services — Liste des services avec praticiens assignés
 * Query params: include_inactive (bool, default false)
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
  const includeInactive = searchParams.get("include_inactive") === "true";

  let query = supabase
    .from("services")
    .select("*, practitioner_services(practitioner_id)")
    .eq("merchant_id", merchant.id)
    .order("sort_order", { ascending: true });

  if (!includeInactive) {
    query = query.eq("is_active", true);
  }

  const { data: services, error } = await query;

  if (error) {
    logger.error("services.list_failed", { error: error.message, traceId });
    return apiError("Failed to fetch services", 500, { traceId });
  }

  const data: ServiceWithPractitioners[] = (services ?? []).map((s) => {
    const { practitioner_services, ...serviceFields } = s as ServiceRow & {
      practitioner_services: { practitioner_id: string }[];
    };
    return {
      ...serviceFields,
      practitioner_ids: (practitioner_services ?? []).map((ps) => ps.practitioner_id),
    };
  });

  return NextResponse.json({ data });
}

/**
 * POST /api/v1/services — Créer un nouveau service
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

  const parsed = createServiceSchema.safeParse(body);
  if (!parsed.success) {
    return apiError("Validation failed", 400, {
      traceId,
      details: parsed.error.flatten().fieldErrors as Record<string, unknown>,
    });
  }

  const { name, duration_minutes, price_cents, description, is_active } = parsed.data;

  // Calculer sort_order = max(sort_order) + 1
  // NOTE: race condition théorique si deux POST simultanés obtiennent le même max.
  // sort_order n'a pas de contrainte UNIQUE donc les doublons sont acceptables ;
  // le tri reste cohérent. Pour éliminer totalement la race, utiliser une séquence
  // Postgres dédiée ou DEFAULT nextval('services_sort_order_seq').
  const { data: maxRow } = await supabase
    .from("services")
    .select("sort_order")
    .eq("merchant_id", merchant.id)
    .order("sort_order", { ascending: false })
    .limit(1)
    .single();

  const sortOrder = maxRow ? maxRow.sort_order + 1 : 0;

  const { data: created, error } = await supabase
    .from("services")
    .insert({
      merchant_id: merchant.id,
      name,
      duration_minutes,
      price_cents,
      description: description ?? null,
      is_active: is_active ?? true,
      sort_order: sortOrder,
    })
    .select()
    .single();

  if (error) {
    logger.error("services.create_failed", { error: error.message, traceId });
    return apiError("Failed to create service", 500, { traceId });
  }

  logger.info("services.created", { serviceId: created.id, merchantId: merchant.id, traceId });

  return NextResponse.json(created, { status: 201 });
}
