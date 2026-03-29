import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { checkRateLimit } from "@/lib/rate-limit";
import { securityLog } from "@/lib/logger";

// Dashboard route group pages (Next.js strips the (dashboard) group from URLs)
const DASHBOARD_PATHS = ["/agenda", "/clients", "/messages", "/services", "/stats", "/settings"];

// Rate limit config per route category
const RATE_LIMITS = {
  webhook: { maxRequests: 120, windowMs: 60_000 },  // 120/min per IP (WhatsApp sends bursts)
  booking: { maxRequests: 10, windowMs: 60_000 },    // 10/min per IP (public booking)
  api: { maxRequests: 60, windowMs: 60_000 },        // 60/min per IP
  auth: { maxRequests: 5, windowMs: 300_000 },        // 5/5min per IP (login)
} as const;

export const config = {
  matcher: [
    "/agenda/:path*",
    "/clients/:path*",
    "/messages/:path*",
    "/services/:path*",
    "/stats/:path*",
    "/settings/:path*",
    "/login",
    "/api/v1/:path*",
  ],
};

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  // Prefer Vercel's trusted header, then Cloudflare, then X-Forwarded-For first hop
  const clientIp =
    request.headers.get("x-vercel-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("cf-connecting-ip") ??
    request.headers.get("x-real-ip") ??
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    "unknown";
  const rawTraceId = request.headers.get("x-trace-id");
  const traceId =
    rawTraceId && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(rawTraceId)
      ? rawTraceId
      : crypto.randomUUID();

  // --- Rate limiting ---
  const rateLimitCategory = pathname.startsWith("/api/v1/webhooks")
    ? "webhook"
    : pathname.startsWith("/api/v1/booking/")
      ? "booking"
      : pathname === "/login"
        ? "auth"
        : pathname.startsWith("/api/v1/")
          ? "api"
          : null;

  if (rateLimitCategory) {
    const { maxRequests, windowMs } = RATE_LIMITS[rateLimitCategory];
    const result = checkRateLimit(`${rateLimitCategory}:${clientIp}`, maxRequests, windowMs);

    if (!result.allowed) {
      securityLog.rateLimited(rateLimitCategory, clientIp, traceId);
      return NextResponse.json(
        { error: "Too many requests" },
        {
          status: 429,
          headers: {
            "Retry-After": String(Math.ceil((result.resetAt - Date.now()) / 1000)),
            "X-RateLimit-Limit": String(maxRequests),
            "X-RateLimit-Remaining": "0",
            "X-Trace-Id": traceId,
          },
        },
      );
    }
  }

  // --- Health endpoint: no auth needed, just rate limiting ---
  if (pathname === "/api/v1/health") {
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set("x-trace-id", traceId);
    const response = NextResponse.next({
      request: { headers: requestHeaders },
    });
    response.headers.set("x-trace-id", traceId);
    return response;
  }

  // --- Public booking routes: no auth needed, just rate limiting ---
  if (pathname.startsWith("/api/v1/booking/")) {
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set("x-trace-id", traceId);
    const response = NextResponse.next({
      request: { headers: requestHeaders },
    });
    response.headers.set("x-trace-id", traceId);
    return response;
  }

  // --- Webhooks: no auth needed, just rate limiting + size limit ---
  if (pathname.startsWith("/api/v1/webhooks")) {
    const contentLength = parseInt(request.headers.get("content-length") ?? "0", 10);
    if (contentLength > 1_048_576) {
      return NextResponse.json(
        { error: "Payload too large" },
        { status: 413, headers: { "X-Trace-Id": traceId } },
      );
    }
    const webhookHeaders = new Headers(request.headers);
    webhookHeaders.set("x-trace-id", traceId);
    const response = NextResponse.next({
      request: { headers: webhookHeaders },
    });
    response.headers.set("x-trace-id", traceId);
    return response;
  }

  // --- T098: Propagate trace ID to downstream API routes via request headers ---
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-trace-id", traceId);

  // --- Supabase auth ---
  const supabaseResponse = NextResponse.next({
    request: { headers: requestHeaders },
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            request.cookies.set(name, value);
            supabaseResponse.cookies.set(name, value, options);
          });
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isDashboardRoute = DASHBOARD_PATHS.some(
    (p) => pathname === p || pathname.startsWith(p + "/"),
  );

  if (!user && isDashboardRoute) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/login";
    return NextResponse.redirect(redirectUrl);
  }

  if (!user && pathname.startsWith("/api/v1/")) {
    securityLog.unauthorized(pathname, clientIp, traceId);
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401, headers: { "X-Trace-Id": traceId } },
    );
  }

  // Propagate Trace ID for observability
  supabaseResponse.headers.set("x-trace-id", traceId);

  return supabaseResponse;
}
