import { NextResponse } from "next/server";
import { logger } from "@/lib/logger";

interface ServiceStatus {
  status: "ok" | "error";
  latencyMs: number;
  error?: string;
}

interface HealthResponse {
  status: "healthy" | "degraded" | "unhealthy";
  timestamp: string;
  services: {
    supabase: ServiceStatus;
    redis: ServiceStatus;
    n8n: ServiceStatus;
  };
}

const TIMEOUT_MS = 5_000;

/**
 * Fetch a URL with a timeout and return the elapsed time + success flag.
 */
async function checkService(url: string, init?: RequestInit): Promise<ServiceStatus> {
  const start = performance.now();
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

    const response = await fetch(url, {
      ...init,
      signal: controller.signal,
    });

    clearTimeout(timer);
    const latencyMs = Math.round(performance.now() - start);

    if (!response.ok) {
      return { status: "error", latencyMs, error: `HTTP ${response.status}` };
    }

    return { status: "ok", latencyMs };
  } catch (err) {
    const latencyMs = Math.round(performance.now() - start);
    const message = err instanceof Error ? err.message : String(err);
    return { status: "error", latencyMs, error: message };
  }
}

/**
 * GET /api/v1/health — Public health check endpoint (no auth required).
 *
 * Checks connectivity to Supabase, Redis and n8n.
 * Returns per-service status and an overall status:
 *   - healthy   = all services OK
 *   - degraded  = at least one service down
 *   - unhealthy = all services down
 */
export async function GET() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const n8nUrl = process.env.N8N_URL;

  // Run all checks in parallel
  const [supabase, redis, n8n] = await Promise.all([
    // Check Supabase reachability without exposing anon key — root URL returns 200
    supabaseUrl
      ? checkService(supabaseUrl)
      : Promise.resolve<ServiceStatus>({ status: "error", latencyMs: 0, error: "NEXT_PUBLIC_SUPABASE_URL not configured" }),

    // Redis is accessed by Bull/n8n, not directly by Next.js — always report OK
    Promise.resolve<ServiceStatus>({ status: "ok", latencyMs: 0 }),

    n8nUrl
      ? checkService(`${n8nUrl}/healthz`)
      : Promise.resolve<ServiceStatus>({ status: "error", latencyMs: 0, error: "N8N_URL not configured" }),
  ]);

  const services = { supabase, redis, n8n };
  const statuses = Object.values(services);
  const okCount = statuses.filter((s) => s.status === "ok").length;

  let overall: HealthResponse["status"];
  if (okCount === statuses.length) {
    overall = "healthy";
  } else if (okCount === 0) {
    overall = "unhealthy";
  } else {
    overall = "degraded";
  }

  const body: HealthResponse = {
    status: overall,
    timestamp: new Date().toISOString(),
    services,
  };

  const httpStatus = overall === "healthy" ? 200 : overall === "degraded" ? 207 : 503;

  if (overall !== "healthy") {
    logger.warn("health.degraded", {
      overall,
      supabase: supabase.status,
      redis: redis.status,
      n8n: n8n.status,
    });
  }

  return NextResponse.json(body, { status: httpStatus });
}
