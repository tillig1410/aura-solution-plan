/**
 * Shared pricing grid — importable from both server and client code.
 * No Stripe SDK dependency.
 */

export const SEAT_PRICES: Record<number, { base: number; voice: number }> = {
  1: { base: 1690, voice: 700 },
  2: { base: 2490, voice: 1400 },
  3: { base: 3190, voice: 2100 },
  4: { base: 3890, voice: 2800 },
  5: { base: 4490, voice: 3500 },
  6: { base: 4990, voice: 4200 },
  7: { base: 5490, voice: 5200 },
};

/**
 * Calculate the monthly price in cents for a given configuration.
 */
export function calculatePrice(seatCount: number, voiceEnabled: boolean): number {
  const clampedSeats = Math.max(1, Math.min(7, seatCount));
  const tier = SEAT_PRICES[clampedSeats];
  return tier.base + (voiceEnabled ? tier.voice : 0);
}

/**
 * Format cents to localized EUR string (e.g. "16,90 €").
 */
export function formatEur(cents: number): string {
  return (cents / 100).toFixed(2).replace(".", ",") + " €";
}
