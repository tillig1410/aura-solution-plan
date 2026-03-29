import QRCode from "qrcode";

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://app.aura-book.fr";

/**
 * Retourne l'URL complète du site de réservation pour un salon.
 */
export const getBookingUrl = (slug: string): string => {
  return `${BASE_URL}/${slug}`;
};

/**
 * Génère un data URL (base64 PNG) du QR code pour le site de réservation.
 * @param slug - Le slug du salon
 * @param size - Taille en pixels du QR (default 300)
 */
export const generateQrCodeDataUrl = async (slug: string, size = 300): Promise<string> => {
  const bookingUrl = getBookingUrl(slug);
  return QRCode.toDataURL(bookingUrl, { width: size, margin: 2 });
};
