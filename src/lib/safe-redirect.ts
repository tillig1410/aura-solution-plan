/**
 * Build a safe redirect URL using a trusted origin.
 *
 * Prevents open redirect attacks by never using the request Host header
 * to construct redirect targets. Instead, uses NEXT_PUBLIC_APP_URL or
 * falls back to validating against an allowlist of known domains.
 */

const TRUSTED_ORIGIN = process.env.NEXT_PUBLIC_APP_URL ?? "";

const ALLOWED_ORIGINS = new Set(
  [
    TRUSTED_ORIGIN,
    // Vercel preview deployments
    process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "",
  ].filter(Boolean),
);

/**
 * Create a safe absolute URL for redirects.
 * Only allows paths (starting with /) on the trusted origin.
 *
 * @param path - Must start with "/" (relative path only)
 * @param fallbackOrigin - Used only in development if NEXT_PUBLIC_APP_URL is not set
 */
export function safeRedirectUrl(path: string, fallbackOrigin?: string): URL {
  if (!path.startsWith("/") || path.startsWith("//")) {
    // Never allow absolute URLs or protocol-relative URLs as paths
    return new URL("/login", resolveOrigin(fallbackOrigin));
  }

  return new URL(path, resolveOrigin(fallbackOrigin));
}

/**
 * Validate that a given URL string points to a trusted origin.
 */
export function isTrustedOrigin(url: string): boolean {
  try {
    const parsed = new URL(url);
    return ALLOWED_ORIGINS.has(parsed.origin);
  } catch {
    return false;
  }
}

function resolveOrigin(fallback?: string): string {
  if (TRUSTED_ORIGIN) return TRUSTED_ORIGIN;

  // Development fallback
  if (fallback && process.env.NODE_ENV !== "production") return fallback;

  // Last resort: localhost
  return "http://localhost:3000";
}
