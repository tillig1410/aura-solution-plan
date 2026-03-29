import Stripe from "stripe";
import { logger } from "@/lib/logger";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY ?? "", {
  apiVersion: "2026-03-25.dahlia",
});

/**
 * T066 — Stripe Connect onboarding helper.
 * Creates a Standard Connect account and generates an onboarding link.
 */

/**
 * Create a Stripe Connect Standard account for a merchant.
 */
export async function createConnectAccount(
  merchantEmail: string,
  merchantName: string,
): Promise<{ accountId: string; onboardingUrl: string }> {
  const account = await stripe.accounts.create({
    type: "standard",
    email: merchantEmail,
    business_profile: {
      name: merchantName,
      mcc: "7230", // Barber and beauty shops
    },
    metadata: { source: "plan-saas" },
  });

  const accountLink = await stripe.accountLinks.create({
    account: account.id,
    refresh_url: `${process.env.NEXT_PUBLIC_APP_URL}/settings?tab=paiements&stripe=refresh`,
    return_url: `${process.env.NEXT_PUBLIC_APP_URL}/settings?tab=paiements&stripe=success`,
    type: "account_onboarding",
  });

  logger.info("stripe.connect_account_created", { accountId: account.id });

  return {
    accountId: account.id,
    onboardingUrl: accountLink.url,
  };
}

/**
 * Check the status of a Stripe Connect account.
 */
export async function getConnectAccountStatus(
  accountId: string,
): Promise<{
  chargesEnabled: boolean;
  payoutsEnabled: boolean;
  detailsSubmitted: boolean;
}> {
  const account = await stripe.accounts.retrieve(accountId);

  return {
    chargesEnabled: account.charges_enabled,
    payoutsEnabled: account.payouts_enabled ?? false,
    detailsSubmitted: account.details_submitted ?? false,
  };
}

/**
 * Generate a new onboarding link for an existing account (e.g., after refresh/incomplete).
 */
export async function createOnboardingLink(accountId: string): Promise<string> {
  const accountLink = await stripe.accountLinks.create({
    account: accountId,
    refresh_url: `${process.env.NEXT_PUBLIC_APP_URL}/settings?tab=paiements&stripe=refresh`,
    return_url: `${process.env.NEXT_PUBLIC_APP_URL}/settings?tab=paiements&stripe=success`,
    type: "account_onboarding",
  });

  return accountLink.url;
}

/**
 * Create a Stripe login link for an existing Connect account (dashboard access).
 */
export async function createDashboardLink(accountId: string): Promise<string> {
  const loginLink = await stripe.accounts.createLoginLink(accountId);
  return loginLink.url;
}
