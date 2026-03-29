import { NextResponse } from "next/server";

interface ApiErrorBody {
  error: string;
  code?: string;
  traceId?: string;
  details?: Record<string, unknown>;
}

/**
 * Standardized API error response.
 * Format: { error, code?, traceId?, details? }
 */
export function apiError(
  message: string,
  status: number,
  opts?: { code?: string; traceId?: string; details?: Record<string, unknown> },
): NextResponse<ApiErrorBody> {
  const body: ApiErrorBody = { error: message };
  if (opts?.code) body.code = opts.code;
  if (opts?.traceId) body.traceId = opts.traceId;
  if (opts?.details) body.details = opts.details;

  return NextResponse.json(body, {
    status,
    headers: opts?.traceId ? { "X-Trace-Id": opts.traceId } : undefined,
  });
}
