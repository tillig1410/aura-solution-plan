import type { NextConfig } from "next";

// CSP directives — Next.js 14 App Router requires 'unsafe-inline' for
// inline scripts injected during hydration. Nonce-based CSP would require
// per-request middleware which is out of scope for now.
const CSP = [
  "default-src 'self'",
  // Next.js inline scripts + no external JS CDN
  "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
  // Tailwind/shadcn inline styles
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com",
  // Images: allow data URIs (QR codes) and external HTTPS
  "img-src 'self' data: https:",
  // API connections: Supabase (REST + Realtime), Stripe
  [
    "connect-src 'self'",
    "https://*.supabase.co",
    "wss://*.supabase.co",
    "https://api.stripe.com",
    "https://js.stripe.com",
  ].join(" "),
  // Stripe 3DS iframes
  "frame-src 'self' https://js.stripe.com https://hooks.stripe.com",
  // Deny plugins, fallback base
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "upgrade-insecure-requests",
].join("; ");

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
          { key: "X-DNS-Prefetch-Control", value: "on" },
          { key: "Content-Security-Policy", value: CSP },
          { key: "Cross-Origin-Opener-Policy", value: "same-origin-allow-popups" },
        ],
      },
    ];
  },
};

export default nextConfig;
