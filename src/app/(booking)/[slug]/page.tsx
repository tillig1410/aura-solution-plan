import { cache } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import BookingContent from "@/components/booking/booking-content";
import { createAdminClient } from "@/lib/supabase/server";

interface BookingPageProps {
  params: Promise<{ slug: string }>;
}

/** Cached per-render to avoid double DB call between generateMetadata and the page. */
const getMerchant = cache(async (slug: string) => {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("merchants")
    .select("name, address, phone")
    .eq("slug", slug)
    .single();
  return data;
});

export async function generateMetadata({ params }: BookingPageProps): Promise<Metadata> {
  const { slug } = await params;
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";
  const url = `${baseUrl}/${slug}`;

  const merchant = await getMerchant(slug);

  const salonName =
    merchant?.name ??
    slug.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

  const description = `Réservez en ligne chez ${salonName}${
    merchant?.address ? ` — ${merchant.address}` : ""
  }. Choisissez votre prestation, praticien et créneau.`;

  return {
    title: `Réservation — ${salonName}`,
    description,
    alternates: {
      canonical: url,
    },
    openGraph: {
      title: `Réservez chez ${salonName}`,
      description,
      url,
      type: "website",
      locale: "fr_FR",
      siteName: "Resaapp",
    },
    // Fonctionnalité site de résa publique annulée 2026-04-08.
    // noindex, nofollow : empêche toute nouvelle indexation + signale à
    // Google de retirer les pages déjà indexées au prochain crawl.
    robots: { index: false, follow: false },
  };
}

const BookingPage = async ({ params }: BookingPageProps) => {
  const { slug } = await params;
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";
  const merchant = await getMerchant(slug);

  // Fonctionnalité site de résa publique annulée 2026-04-08 — si le slug
  // ne matche aucun merchant, retourner 404 au lieu d'une page vide qui
  // Google verrait comme "soft 404" (source des erreurs Search Console).
  if (!merchant) {
    notFound();
  }

  const jsonLd = merchant
    ? {
        "@context": "https://schema.org",
        "@type": "BeautySalon",
        name: merchant.name,
        ...(merchant.address && { address: merchant.address }),
        ...(merchant.phone && { telephone: merchant.phone }),
        url: `${baseUrl}/${slug}`,
        potentialAction: {
          "@type": "ReserveAction",
          target: {
            "@type": "EntryPoint",
            urlTemplate: `${baseUrl}/${slug}`,
          },
        },
      }
    : null;

  return (
    <>
      {jsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      )}
      <BookingContent />
    </>
  );
};

export default BookingPage;
