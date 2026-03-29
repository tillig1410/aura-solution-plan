/**
 * T095 — Génération d'URL de QR code pour le site de réservation.
 *
 * Utilise l'API Google Charts pour générer un QR code sans dépendance.
 * Le QR code pointe vers l'URL de réservation du salon.
 */

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://app.aura-book.fr";

/**
 * Retourne l'URL complète du site de réservation pour un salon.
 */
export const getBookingUrl = (slug: string): string => {
  return `${BASE_URL}/${slug}`;
};

/**
 * Retourne l'URL d'une image QR code (via Google Charts API) pour le site de réservation.
 * @param slug - Le slug du salon
 * @param size - Taille en pixels du QR (default 300)
 */
export const getQrCodeUrl = (slug: string, size = 300): string => {
  const bookingUrl = getBookingUrl(slug);
  const encodedUrl = encodeURIComponent(bookingUrl);
  return `https://chart.googleapis.com/chart?cht=qr&chs=${size}x${size}&chl=${encodedUrl}&choe=UTF-8`;
};
