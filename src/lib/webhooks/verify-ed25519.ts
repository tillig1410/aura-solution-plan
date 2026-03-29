import { createPublicKey, verify } from "crypto";

/**
 * Verify Telnyx webhook ed25519 signature.
 *
 * Telnyx signs: `${timestamp}|${payload}`
 * Headers: telnyx-signature-ed25519 (base64), telnyx-timestamp
 * Public key: TELNYX_PUBLIC_KEY env var (base64-encoded ed25519 public key)
 *
 * @see https://developers.telnyx.com/docs/v2/development/api-guide/webhooks#webhook-signing
 */
export function verifyTelnyxSignature(
  payload: string,
  signature: string,
  timestamp: string,
  publicKeyBase64: string,
): boolean {
  if (!payload || !signature || !timestamp || !publicKeyBase64) {
    return false;
  }

  // Reject timestamps older than 5 minutes (replay protection)
  const timestampAge = Date.now() / 1000 - Number(timestamp);
  if (Number.isNaN(timestampAge) || timestampAge > 300 || timestampAge < -60) {
    return false;
  }

  try {
    // Telnyx signed data format: timestamp|payload
    const signedData = Buffer.from(`${timestamp}|${payload}`);
    const signatureBuffer = Buffer.from(signature, "base64");

    // Build ed25519 public key from raw base64
    const publicKeyDer = Buffer.concat([
      // ed25519 DER prefix (ASN.1 header for SubjectPublicKeyInfo)
      Buffer.from("302a300506032b6570032100", "hex"),
      Buffer.from(publicKeyBase64, "base64"),
    ]);

    const publicKey = createPublicKey({
      key: publicKeyDer,
      format: "der",
      type: "spki",
    });

    return verify(null, signedData, publicKey, signatureBuffer);
  } catch {
    return false;
  }
}
