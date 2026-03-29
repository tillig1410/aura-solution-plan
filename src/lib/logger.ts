/**
 * Structured JSON logger for Plan API.
 *
 * Outputs one JSON object per line to stdout/stderr.
 * Compatible with Vercel Logs, Datadog, CloudWatch, etc.
 *
 * Every log entry includes:
 * - timestamp (ISO 8601)
 * - level (info, warn, error)
 * - event (machine-readable event name)
 * - traceId (propagated from middleware X-Trace-Id header)
 * - Arbitrary context fields
 */

type LogLevel = "info" | "warn" | "error";

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  event: string;
  traceId?: string;
  [key: string]: unknown;
}

function emit(level: LogLevel, event: string, context: Record<string, unknown> = {}): void {
  const entry: LogEntry = {
    timestamp: new Date().toISOString(),
    level,
    event,
    ...context,
  };

  const line = JSON.stringify(entry);

  if (level === "error") {
    process.stderr.write(line + "\n");
  } else {
    process.stdout.write(line + "\n");
  }
}

export const logger = {
  info: (event: string, context?: Record<string, unknown>) => emit("info", event, context),
  warn: (event: string, context?: Record<string, unknown>) => emit("warn", event, context),
  error: (event: string, context?: Record<string, unknown>) => emit("error", event, context),
};

// --- Security event helpers (OWASP A09) ---

export const securityLog = {
  /** Webhook signature validation failed */
  signatureRejected: (channel: string, traceId?: string, ip?: string) =>
    logger.warn("security.signature_rejected", { channel, traceId, ip }),

  /** Rate limit exceeded */
  rateLimited: (category: string, ip: string, traceId?: string) =>
    logger.warn("security.rate_limited", { category, ip, traceId }),

  /** Unauthorized API access attempt */
  unauthorized: (path: string, ip: string, traceId?: string) =>
    logger.warn("security.unauthorized", { path, ip, traceId }),

  /** Cross-tenant FK reference blocked */
  crossTenantBlocked: (entity: string, merchantId: string, traceId?: string) =>
    logger.warn("security.cross_tenant_blocked", { entity, merchantId, traceId }),

  /** Missing or invalid server configuration */
  misconfiguration: (detail: string) =>
    logger.error("security.misconfiguration", { detail }),
};

// --- Business event helpers ---

export const bookingLog = {
  created: (bookingId: string, merchantId: string, traceId?: string) =>
    logger.info("booking.created", { bookingId, merchantId, traceId }),

  slotConflict: (merchantId: string, practitionerId: string, startsAt: string, traceId?: string) =>
    logger.warn("booking.slot_conflict", { merchantId, practitionerId, startsAt, traceId }),

  versionConflict: (bookingId: string, traceId?: string) =>
    logger.warn("booking.version_conflict", { bookingId, traceId }),

  cancelled: (bookingId: string, cancelledBy: string, traceId?: string) =>
    logger.info("booking.cancelled", { bookingId, cancelledBy, traceId }),
};

export const webhookLog = {
  received: (channel: string, traceId?: string) =>
    logger.info("webhook.received", { channel, traceId }),

  forwarded: (channel: string, traceId?: string) =>
    logger.info("webhook.forwarded", { channel, traceId }),

  forwardFailed: (channel: string, error: string, traceId?: string) =>
    logger.error("webhook.forward_failed", { channel, error, traceId }),

  invalidPayload: (channel: string, reason: string, traceId?: string) =>
    logger.warn("webhook.invalid_payload", { channel, reason, traceId }),
};
