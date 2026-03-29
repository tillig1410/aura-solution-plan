import { NextResponse, type NextRequest } from "next/server";
import { verifyTelnyxSignature } from "@/lib/webhooks/verify-ed25519";
import { normalizeTelnyxSMS } from "@/lib/webhooks/normalize";
import { forwardToN8n } from "@/lib/webhooks/forward-to-n8n";
import { extractVoiceEvent, handleVoiceEvent } from "@/lib/telnyx/voice";
import { createAdminClient } from "@/lib/supabase/server";
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

  // 1. Try SMS normalization first
  const normalized = normalizeTelnyxSMS(body);
  if (normalized) {
    forwardToN8n(normalized, "Telnyx");
    webhookLog.forwarded("telnyx", traceId);
    return NextResponse.json({ status: "ok" });
  }

  // 2. Try Voice event handling (T080)
  const voiceEvent = extractVoiceEvent(body);
  if (voiceEvent) {
    // Look up merchant by telnyx_phone_number to check voice_enabled
    const toNumber = voiceEvent.payload.to;
    const supabase = createAdminClient();

    const { data: merchant } = await supabase
      .from("merchants")
      .select("id, voice_enabled")
      .eq("telnyx_phone_number", toNumber)
      .single();

    const voiceEnabled = merchant?.voice_enabled ?? false;

    await handleVoiceEvent(voiceEvent, voiceEnabled, traceId);

    // If it's a gather.ended event with transcription, forward to n8n
    if (voiceEvent.event_type === "call.gather.ended") {
      const result = (voiceEvent.payload as unknown as Record<string, unknown>).result as string | undefined;
      if (result && merchant) {
        forwardToN8n(
          {
            channel: "voice",
            sender_id: voiceEvent.payload.from,
            sender_name: null,
            message_text: result,
            message_id: voiceEvent.id,
            timestamp: voiceEvent.occurred_at,
          },
          "Telnyx-Voice",
        );
        webhookLog.forwarded("telnyx-voice", traceId);
      }
    }

    return NextResponse.json({ status: "ok" });
  }

  // 3. Unknown event type — acknowledge
  return NextResponse.json({ status: "ok" });
}
