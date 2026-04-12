import type { MetadataRoute } from "next";

/**
 * Robots.txt minimal : seule la landing `/` est indexable publiquement.
 * Tout le reste (dashboard auth + fonctionnalité site de résa annulée) est
 * exclu pour éviter que Google tente d'indexer des pages derrière auth ou
 * des slugs merchants qui n'existent plus.
 */
export default function robots(): MetadataRoute.Robots {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";

  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/sitemap.xml", "/robots.txt"],
        disallow: [
          "/api/",
          "/agenda",
          "/clients",
          "/messages",
          "/services",
          "/settings",
          "/stats",
          "/login",
          "/onboarding",
          "/payment/",
          // Fonctionnalité site de résa publique annulée 2026-04-08 —
          // le seul slug en base est "-" (fallback Unicode). Disallow pour
          // éviter les 404 Google Search Console. Les pages /[slug]
          // retournent aussi notFound() + noindex côté app (double barrière).
          "/-",
          "/-/",
        ],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
