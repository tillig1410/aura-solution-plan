import { NextResponse, type NextRequest } from "next/server";
import { verifyTelnyxSignature } from "@/lib/webhooks/verify-ed25519";
import { normalizeTelnyxSMS } from "@/lib/webhooks/normalize";
import { forwardToN8n } from "@/lib/webhooks/forward-to-n8n";
import { securityLog, webhookLog } from "@/lib/logger";

export async function POST(request: NextRequest) {
  const traceId = request.headers.get("x-trace-id") ?? undefined;
  const rawBody = await request.text();

  webhookLog.received("telnyx", traceId);

  // Validate ed25519 signature
  const signature = request.headers.get("telnyx-signature-ed25519") ?? "";
  const timestamp = request.headers.get("telnyx-timestamp") ?? "";
  const publicKey = process.env.TELNYX_PUBLIC_KEY ?? "";

  if (!publicKey) {
    securityLog.misconfiguration("TELNYX_PUBLIC_KEY not configured");
    return NextResponse.json({ error: "Server misconfiguration" }, { status: 500 });
  }

  if (!verifyTelnyxSignature(rawBody, signature, timestamp, publicKey)) {
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
    securityLog.signatureRejected("telnyx", traceId, ip);
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = JSON.parse(rawBody);
  } catch {
    webhookLog.invalidPayload("telnyx", "malformed JSON", traceId);
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const normalized = normalizeTelnyxSMS(body);

  if (!normalized) {
    // Could be a voice event — handle in Phase 8 (US6)
    return NextResponse.json({ status: "ok" });
  }

  forwardToN8n(normalized, "Telnyx");
  webhookLog.forwarded("telnyx", traceId);

  return NextResponse.json({ status: "ok" });
}
