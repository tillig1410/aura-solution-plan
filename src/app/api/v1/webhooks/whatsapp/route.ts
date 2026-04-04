import { NextResponse, type NextRequest } from "next/server";
import { verifyHmacSha256 } from "@/lib/webhooks/verify-hmac";
import { normalizeWhatsApp } from "@/lib/webhooks/normalize";
import { forwardToN8n } from "@/lib/webhooks/forward-to-n8n";
import { securityLog, webhookLog } from "@/lib/logger";

/**
 * GET — WhatsApp webhook verification (subscribe challenge)
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  if (mode === "subscribe" && token === process.env.WHATSAPP_VERIFY_TOKEN) {
    return new NextResponse(challenge, { status: 200 });
  }

  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}

/**
 * POST — Receive WhatsApp messages
 * 1. Validate HMAC signature
 * 2. Normalize message
 * 3. Forward to n8n webhook (async)
 * 4. Return 200 immediately (WhatsApp requires <5s response)
 */
export async function POST(request: NextRequest) {
  const traceId = request.headers.get("x-trace-id") ?? undefined;
  const rawBody = await request.text();

  webhookLog.received("whatsapp", traceId);

  // 1. Validate HMAC
  const signature = request.headers.get("x-hub-signature-256") ?? "";
  const secret = process.env.WHATSAPP_APP_SECRET ?? "";

  if (!secret) {
    securityLog.misconfiguration("WHATSAPP_APP_SECRET not configured");
    return NextResponse.json({ error: "Server misconfiguration" }, { status: 500 });
  }

  if (!verifyHmacSha256(rawBody, signature, secret)) {
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
    securityLog.signatureRejected("whatsapp", traceId, ip);
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  // 2. Parse and normalize
  let body: Record<string, unknown>;
  try {
    body = JSON.parse(rawBody);
  } catch {
    webhookLog.invalidPayload("whatsapp", "malformed JSON", traceId);
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const normalized = normalizeWhatsApp(body);

  if (!normalized) {
    // Non-message event (status update, etc.) — acknowledge
    return NextResponse.json({ status: "ok" });
  }

  // 3. Forward to n8n (fire-and-forget, HTTPS enforced in production)
  forwardToN8n(normalized, "WhatsApp");
  webhookLog.forwarded("whatsapp", traceId);

  // 4. Return 200 immediately
  return NextResponse.json({ status: "ok" });
}
