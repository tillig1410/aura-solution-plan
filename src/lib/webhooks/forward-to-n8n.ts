import type { NormalizedMessage } from "@/lib/webhooks/normalize";
import { securityLog, webhookLog } from "@/lib/logger";

const n8nUrl = process.env.N8N_WEBHOOK_URL ?? "";
const MAX_RETRIES = 3;
const RETRY_DELAYS = [1_000, 5_000, 15_000]; // exponential backoff (ms)

// Validate URL at startup: must be HTTPS in production
if (n8nUrl && process.env.NODE_ENV === "production" && !n8nUrl.startsWith("https://")) {
  securityLog.misconfiguration(
    "N8N_WEBHOOK_URL must use HTTPS in production — PII data would transit in clear text",
  );
}

async function postWithRetry(payload: string, source: string): Promise<void> {
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const response = await fetch(n8nUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: payload,
      });
      if (response.ok) return;
      if (response.status >= 400 && response.status < 500) {
        webhookLog.forwardFailed(source, `n8n returned ${response.status} (not retryable)`);
        return;
      }
      // 5xx → retry
      if (attempt < MAX_RETRIES) {
        await new Promise((r) => setTimeout(r, RETRY_DELAYS[attempt]));
      }
    } catch (err) {
      if (attempt === MAX_RETRIES) {
        webhookLog.forwardFailed(source, err instanceof Error ? err.message : String(err));
        return;
      }
      await new Promise((r) => setTimeout(r, RETRY_DELAYS[attempt]));
    }
  }
  webhookLog.forwardFailed(source, `Failed after ${MAX_RETRIES} retries`);
}

/**
 * Forward a normalized message to n8n webhook (fire-and-forget with retry).
 * Rejects non-HTTPS URLs in production to prevent PII leakage.
 * Retries up to 3 times with exponential backoff on 5xx/network errors.
 */
export function forwardToN8n(message: NormalizedMessage, source: string): void {
  if (!n8nUrl) return;

  if (process.env.NODE_ENV === "production" && !n8nUrl.startsWith("https://")) {
    securityLog.misconfiguration(`${source}: N8N_WEBHOOK_URL must use HTTPS in production`);
    return;
  }

  postWithRetry(JSON.stringify(message), source).catch((err) => {
    webhookLog.forwardFailed(source, err instanceof Error ? err.message : String(err));
  });
}
