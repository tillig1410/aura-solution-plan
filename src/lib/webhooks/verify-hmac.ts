import { createHmac, timingSafeEqual } from "crypto";

/**
 * Verify HMAC-SHA256 signature for webhook payloads.
 * Used by WhatsApp, Messenger, and Stripe webhooks.
 *
 * Uses Node.js native crypto.timingSafeEqual (constant-time at C++ level)
 * to prevent timing attacks on signature comparison.
 */
export function verifyHmacSha256(
  payload: string,
  signature: string,
  secret: string,
): boolean {
  if (!secret) return false;

  const expected = Buffer.from(
    "sha256=" + createHmac("sha256", secret).update(payload).digest("hex"),
  );
  const received = Buffer.from(signature);

  if (expected.length !== received.length) return false;

  return timingSafeEqual(expected, received);
}
