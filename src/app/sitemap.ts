import type { MetadataRoute } from "next";

/**
 * Sitemap minimal : la fonctionnalité "site de réservation public /[slug]" est
 * annulée (décision 2026-04-08). On n'expose plus que la landing page `/`.
 *
 * Historique : la version précédente exposait un /{merchant.slug} par merchant,
 * mais le slug fallback pour les noms Unicode non-ASCII donnait "-" → l'URL
 * `/-` finissait dans le sitemap et Google remontait des erreurs 404 dans
 * Search Console (2026-04-08).
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";

  return [
    {
      url: baseUrl,
      lastModified: new Date().toISOString(),
      changeFrequency: "monthly",
      priority: 1,
    },
  ];
}
