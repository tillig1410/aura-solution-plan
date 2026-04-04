import { cache } from "react";
import type { Metadata } from "next";
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
      siteName: "Plan",
    },
    robots: { index: true, follow: true },
  };
}

const BookingPage = async ({ params }: BookingPageProps) => {
  const { slug } = await params;
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";
  const merchant = await getMerchant(slug);

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
