import { timingSafeEqual } from "crypto";
import { NextResponse, type NextRequest } from "next/server";
import { normalizeTelegram } from "@/lib/webhooks/normalize";
import { forwardToN8n } from "@/lib/webhooks/forward-to-n8n";
import { securityLog, webhookLog } from "@/lib/logger";

function safeTokenCompare(a: string, b: string): boolean {
  if (!a || !b) return false;
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

export async function POST(request: NextRequest) {
  const traceId = request.headers.get("x-trace-id") ?? undefined;
  const rawBody = await request.text();

  webhookLog.received("telegram", traceId);

  // Validate Telegram webhook secret (set via setWebhook secret_token)
  const secretToken = request.headers.get("x-telegram-bot-api-secret-token") ?? "";
  const expectedToken = process.env.TELEGRAM_WEBHOOK_SECRET ?? "";

  if (!expectedToken) {
    securityLog.misconfiguration("TELEGRAM_WEBHOOK_SECRET not configured");
    return NextResponse.json({ error: "Server misconfiguration" }, { status: 500 });
  }

  if (!safeTokenCompare(secretToken, expectedToken)) {
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
    securityLog.signatureRejected("telegram", traceId, ip);
    return NextResponse.json({ error: "Invalid token" }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = JSON.parse(rawBody);
  } catch {
    webhookLog.invalidPayload("telegram", "malformed JSON", traceId);
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const normalized = normalizeTelegram(body);

  if (!normalized) {
    return NextResponse.json({ status: "ok" });
  }

  forwardToN8n(normalized, "Telegram");
  webhookLog.forwarded("telegram", traceId);

  return NextResponse.json({ status: "ok" });
}
