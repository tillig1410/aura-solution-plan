import { NextResponse, type NextRequest } from "next/server";
import { verifyHmacSha256 } from "@/lib/webhooks/verify-hmac";
import { normalizeMessenger } from "@/lib/webhooks/normalize";
import { forwardToN8n } from "@/lib/webhooks/forward-to-n8n";
import { securityLog, webhookLog } from "@/lib/logger";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  if (mode === "subscribe" && token === process.env.MESSENGER_VERIFY_TOKEN) {
    return new NextResponse(challenge, { status: 200 });
  }

  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}

export async function POST(request: NextRequest) {
  const traceId = request.headers.get("x-trace-id") ?? undefined;
  const rawBody = await request.text();

  webhookLog.received("messenger", traceId);

  const signature = request.headers.get("x-hub-signature-256") ?? "";
  const secret = process.env.MESSENGER_APP_SECRET ?? "";

  if (!verifyHmacSha256(rawBody, signature, secret)) {
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
    securityLog.signatureRejected("messenger", traceId, ip);
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = JSON.parse(rawBody);
  } catch {
    webhookLog.invalidPayload("messenger", "malformed JSON", traceId);
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const normalized = normalizeMessenger(body);

  if (!normalized) {
    return NextResponse.json({ status: "ok" });
  }

  forwardToN8n(normalized, "Messenger");
  webhookLog.forwarded("messenger", traceId);

  return NextResponse.json({ status: "ok" });
}
