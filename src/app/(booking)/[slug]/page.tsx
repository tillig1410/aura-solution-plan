import type { Metadata } from "next";
import BookingContent from "@/components/booking/booking-content";

interface BookingPageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: BookingPageProps): Promise<Metadata> {
  const { slug } = await params;
  const salonName = slug.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  return {
    title: `Réservation — ${salonName}`,
    description: `Réservez en ligne chez ${salonName}. Choisissez votre prestation, praticien et créneau.`,
  };
}

const BookingPage = () => {
  return <BookingContent />;
};

export default BookingPage;
