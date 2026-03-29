import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { apiError } from "@/lib/api-error";
import { logger } from "@/lib/logger";
import type { Database } from "@/types/supabase";

type PractitionerRow = Database["public"]["Tables"]["practitioners"]["Row"];
type PractitionerAvailabilityRow =
  Database["public"]["Tables"]["practitioner_availability"]["Row"];

export interface PractitionerWithDetails extends PractitionerRow {
  service_ids: string[];
  availability: PractitionerAvailabilityRow[];
}

const createPractitionerSchema = z.object({
  name: z.string().min(2, "Le nom doit contenir au moins 2 caractères"),
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, "La couleur doit être au format hexadécimal #RRGGBB"),
  specialties: z.array(z.string()).optional().default([]),
  email: z.string().email("Email invalide").optional(),
});

/**
 * GET /api/v1/practitioners — Liste des praticiens avec services et disponibilités
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

  let practitionersQuery = supabase
    .from("practitioners")
    .select(
      "*, practitioner_services(service_id), practitioner_availability(*)",
    )
    .eq("merchant_id", merchant.id)
    .order("sort_order", { ascending: true });

  if (!includeInactive) {
    practitionersQuery = practitionersQuery.eq("is_active", true);
  }

  const { data: practitioners, error } = await practitionersQuery;

  if (error) {
    logger.error("practitioners.list_failed", { error: error.message, traceId });
    return apiError("Failed to fetch practitioners", 500, { traceId });
  }

  const data: PractitionerWithDetails[] = (practitioners ?? []).map((p) => {
    const { practitioner_services, practitioner_availability, ...practitionerFields } = p as PractitionerRow & {
      practitioner_services: { service_id: string }[];
      practitioner_availability: PractitionerAvailabilityRow[];
    };
    return {
      ...practitionerFields,
      service_ids: (practitioner_services ?? []).map((ps) => ps.service_id),
      availability: practitioner_availability ?? [],
    };
  });

  return NextResponse.json({ data });
}

/**
 * POST /api/v1/practitioners — Créer un nouveau praticien
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

  const parsed = createPractitionerSchema.safeParse(body);
  if (!parsed.success) {
    return apiError("Validation failed", 400, {
      traceId,
      details: parsed.error.flatten().fieldErrors as Record<string, unknown>,
    });
  }

  const { name, color, specialties, email } = parsed.data;

  // Calculer sort_order = max(sort_order) + 1
  const { data: maxRow } = await supabase
    .from("practitioners")
    .select("sort_order")
    .eq("merchant_id", merchant.id)
    .order("sort_order", { ascending: false })
    .limit(1)
    .single();

  const sortOrder = maxRow ? maxRow.sort_order + 1 : 0;

  const { data: created, error } = await supabase
    .from("practitioners")
    .insert({
      merchant_id: merchant.id,
      name,
      color,
      specialties: specialties ?? [],
      email: email ?? null,
      sort_order: sortOrder,
    })
    .select()
    .single();

  if (error) {
    logger.error("practitioners.create_failed", { error: error.message, traceId });
    return apiError("Failed to create practitioner", 500, { traceId });
  }

  logger.info("practitioners.created", {
    practitionerId: created.id,
    merchantId: merchant.id,
    traceId,
  });

  return NextResponse.json(created, { status: 201 });
}
