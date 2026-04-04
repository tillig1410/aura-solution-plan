import type { MetadataRoute } from "next";
import { createAdminClient } from "@/lib/supabase/server";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";

  const supabase = createAdminClient();
  const { data: merchants } = await supabase
    .from("merchants")
    .select("slug, updated_at");

  const bookingPages: MetadataRoute.Sitemap = (merchants ?? []).map((m) => ({
    url: `${baseUrl}/${m.slug}`,
    lastModified: m.updated_at ?? new Date().toISOString(),
    changeFrequency: "weekly",
    priority: 0.8,
  }));

  return [
    {
      url: baseUrl,
      lastModified: new Date().toISOString(),
      changeFrequency: "monthly",
      priority: 1,
    },
    ...bookingPages,
  ];
}
