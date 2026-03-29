import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { apiError } from "@/lib/api-error";

/**
 * GET /api/v1/booking/:slug — Infos publiques du salon (non protégé)
 * Retourne : nom, services actifs, praticiens actifs avec créneaux disponibles
 *
 * SECURITY: Uses createAdminClient (bypasses RLS) because this is a public route
 * with no auth. Only SELECT operations are performed — never INSERT/UPDATE/DELETE.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const supabase = createAdminClient();

  // Charger le commerçant par slug
  const { data: merchant } = await supabase
    .from("merchants")
    .select("id, name, slug, address, phone, opening_hours, ai_name")
    .eq("slug", slug)
    .single();

  if (!merchant) {
    return apiError("Salon not found", 404);
  }

  // Charger les services actifs
  const { data: services } = await supabase
    .from("services")
    .select("id, name, description, duration_minutes, price_cents")
    .eq("merchant_id", merchant.id)
    .eq("is_active", true)
    .order("sort_order", { ascending: true });

  // Charger les praticiens actifs avec leurs services
  const { data: practitioners } = await supabase
    .from("practitioners")
    .select("id, name, color, specialties, practitioner_services(service_id)")
    .eq("merchant_id", merchant.id)
    .eq("is_active", true)
    .order("sort_order", { ascending: true });

  // Charger les disponibilités récurrentes
  const { data: availability } = await supabase
    .from("practitioner_availability")
    .select("practitioner_id, day_of_week, start_time, end_time, is_available, exception_date")
    .eq("merchant_id", merchant.id)
    .eq("is_available", true);

  // Formater la réponse
  const formattedPractitioners = (practitioners ?? []).map((p) => {
    const pServices = (
      p.practitioner_services as { service_id: string }[]
    ).map((ps) => ps.service_id);
    const pAvailability = (availability ?? [])
      .filter((a) => a.practitioner_id === p.id)
      .map((a) => ({
        day_of_week: a.day_of_week,
        start_time: a.start_time,
        end_time: a.end_time,
        exception_date: a.exception_date,
      }));

    return {
      id: p.id,
      name: p.name,
      color: p.color,
      specialties: p.specialties,
      service_ids: pServices,
      availability: pAvailability,
    };
  });

  return NextResponse.json({
    data: {
      name: merchant.name,
      slug: merchant.slug,
      address: merchant.address,
      phone: merchant.phone,
      opening_hours: merchant.opening_hours,
      ai_name: merchant.ai_name,
      services: services ?? [],
      practitioners: formattedPractitioners,
    },
  });
}
