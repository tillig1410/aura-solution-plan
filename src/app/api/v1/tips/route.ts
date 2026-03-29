import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { apiError } from "@/lib/api-error";
import { logger } from "@/lib/logger";

/**
 * T068 — GET /api/v1/tips — Liste des pourboires
 * Query params: practitioner_id, from, to, page, limit
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
  const practitionerId = searchParams.get("practitioner_id");
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const pageRaw = parseInt(searchParams.get("page") ?? "1", 10);
  const limitRaw = parseInt(searchParams.get("limit") ?? "50", 10);

  const page = isNaN(pageRaw) || pageRaw < 1 ? 1 : pageRaw;
  const limit = isNaN(limitRaw) || limitRaw < 1 || limitRaw > 100 ? 50 : limitRaw;
  const offset = (page - 1) * limit;

  let query = supabase
    .from("tips")
    .select(
      `
      *,
      practitioner:practitioners(id, name, color),
      client:clients(id, name, phone)
      `,
      { count: "exact" },
    )
    .eq("merchant_id", merchant.id)
    .order("created_at", { ascending: false });

  if (practitionerId) {
    query = query.eq("practitioner_id", practitionerId);
  }
  if (from) {
    query = query.gte("created_at", from);
  }
  if (to) {
    query = query.lte("created_at", to);
  }

  query = query.range(offset, offset + limit - 1);

  const { data: tips, error, count } = await query;

  if (error) {
    logger.error("tips.list_failed", { error: error.message, traceId });
    return apiError("Failed to fetch tips", 500, { traceId });
  }

  const total = count ?? 0;
  const total_pages = Math.ceil(total / limit);

  return NextResponse.json({ data: tips ?? [], count: total, page, total_pages });
}
