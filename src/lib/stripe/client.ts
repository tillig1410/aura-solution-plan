import Stripe from "stripe";

/**
 * Lazy Stripe client factory.
 *
 * Les env vars Stripe ne sont définies qu'en scope Production sur Vercel.
 * Les builds Preview (Next.js "Collecting page data") importent chaque route
 * au module load — si Stripe throw à l'init, tout le build Preview casse.
 *
 * Ce helper instancie le client uniquement au premier appel runtime,
 * pas au module evaluation. Les routes qui n'appellent jamais Stripe
 * (ex : healthcheck) peuvent builder sans la clé.
 */
let cached: Stripe | null = null;

export function getStripeClient(): Stripe {
  if (cached) return cached;

  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    throw new Error("STRIPE_SECRET_KEY is not configured");
  }

  cached = new Stripe(key, {
    apiVersion: "2026-03-25.dahlia",
  });
  return cached;
}
