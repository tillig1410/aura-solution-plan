/**
 * Shared pricing grid — importable from both server and client code.
 * No Stripe SDK dependency.
 *
 * Source: Pricing_AurA_v2.pdf — Mars 2026
 * Base: 16,90€ (1 siège) → 54,90€ (7 sièges)
 * 8+ sièges: 54,90€ + 6€/siège supplémentaire
 * Voice IA: +7€ (1) → +52€ (10)
 * Early Adopter: -30% à vie (50 premiers)
 */

export const SEAT_PRICES: Record<number, { base: number; voice: number }> = {
  1: { base: 1690, voice: 700 },
  2: { base: 2390, voice: 1200 },
  3: { base: 3190, voice: 1700 },
  4: { base: 3890, voice: 2200 },
  5: { base: 4590, voice: 2700 },
  6: { base: 4990, voice: 3200 },
  7: { base: 5490, voice: 3700 },
};

const EXTRA_SEAT_BASE = 600; // 6€/siège au-delà de 7
const EXTRA_SEAT_VOICE = 500; // +5€/siège au-delà de 7

/**
 * Calculate the monthly price in cents for a given configuration.
 */
export function calculatePrice(seatCount: number, voiceEnabled: boolean): number {
  const seats = Math.max(1, seatCount);
  if (seats <= 7) {
    const tier = SEAT_PRICES[seats];
    return tier.base + (voiceEnabled ? tier.voice : 0);
  }
  // 8+ sièges
  const base7 = SEAT_PRICES[7];
  const extraSeats = seats - 7;
  const base = base7.base + extraSeats * EXTRA_SEAT_BASE;
  const voice = voiceEnabled ? base7.voice + extraSeats * EXTRA_SEAT_VOICE : 0;
  return base + voice;
}

/**
 * Calculate Early Adopter price (-30% à vie).
 */
export function calculateEarlyAdopterPrice(seatCount: number, voiceEnabled: boolean): number {
  return Math.round(calculatePrice(seatCount, voiceEnabled) * 0.7);
}

/**
 * Format cents to localized EUR string (e.g. "16,90 €").
 */
export function formatEur(cents: number): string {
  return (cents / 100).toFixed(2).replace(".", ",") + " €";
}
