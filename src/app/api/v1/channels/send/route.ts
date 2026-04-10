import { timingSafeEqual } from "crypto";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { sendMessage } from "@/lib/channels/send";
import { sanitizeMessageText } from "@/lib/utils/sanitize";
import { apiError } from "@/lib/api-error";
import { logger, securityLog } from "@/lib/logger";

const sendMessageSchema = z.object({
  channel: z.enum(["whatsapp", "messenger", "telegram", "sms", "voice"]),
  recipient_id: z.string().min(1).max(128),
  message: z.string().min(1).max(4096),
  merchant_id: z.string().uuid(),
});

function safeTokenCompare(a: string, b: string): boolean {
  if (!a || !b) return false;
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

/**
 * POST /api/v1/channels/send — Internal endpoint for n8n workflows
 *
 * Authenticates via the X-Internal-Secret header (compared in constant time
 * against INTERNAL_API_SECRET). Sends a sanitized message to the requested
 * channel via the existing sendMessage helper.
 */
export async function POST(request: NextRequest) {
  const traceId = request.headers.get("x-trace-id") ?? undefined;

  const provided = request.headers.get("x-internal-secret") ?? "";
  const expected = process.env.INTERNAL_API_SECRET ?? "";

  if (!expected) {
    securityLog.misconfiguration("INTERNAL_API_SECRET not configured");
    return apiError("Server misconfiguration", 500, { traceId });
  }

  if (!safeTokenCompare(provided, expected)) {
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
    securityLog.signatureRejected("channels-send", traceId, ip);
    return apiError("Unauthorized", 401, { traceId });
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return apiError("Invalid JSON", 400, { traceId });
  }

  const parsed = sendMessageSchema.safeParse(payload);
  if (!parsed.success) {
    return apiError("Invalid payload", 400, {
      traceId,
      details: { issues: parsed.error.flatten() },
    });
  }

  const { channel, recipient_id, message, merchant_id } = parsed.data;
  const safeMessage = sanitizeMessageText(message, 4096);

  const result = await sendMessage({
    channel,
    recipientId: recipient_id,
    message: safeMessage,
    merchantId: merchant_id,
  });

  if (!result.success) {
    logger.warn("channels.send failed", { channel, merchant_id, error: result.error });
    return apiError(result.error ?? "Send failed", 502, { traceId });
  }

  return NextResponse.json({ status: "ok", message_id: result.messageId });
}
