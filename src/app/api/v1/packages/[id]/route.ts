import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { apiError } from "@/lib/api-error";
import { logger } from "@/lib/logger";

const patchPackageSchema = z.object({
  is_active: z.boolean(),
  expected_is_active: z.boolean().optional(),
});

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * PATCH /api/v1/packages/:id — Toggle is_active
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

  const parsed = patchPackageSchema.safeParse(body);
  if (!parsed.success) {
    return apiError("Validation failed", 400, {
      traceId,
      details: parsed.error.flatten().fieldErrors as Record<string, unknown>,
    });
  }

  let query = supabase
    .from("packages")
    .update({ is_active: parsed.data.is_active })
    .eq("id", id)
    .eq("merchant_id", merchant.id);

  // Optimistic lock: if caller provides expected state, require it to match
  if (parsed.data.expected_is_active !== undefined) {
    query = query.eq("is_active", parsed.data.expected_is_active);
  }

  const { data: updated, error } = await query.select().single();

  if (error) {
    logger.error("packages.patch_failed", { error: error.message, traceId });
    return apiError("Failed to update package", 500, { traceId });
  }

  if (!updated) {
    return apiError("Package not found", 404, { traceId });
  }

  return NextResponse.json({ data: updated });
}
