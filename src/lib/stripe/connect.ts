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
 * Create a Stripe Connect account for a merchant.
 * Uses Accounts v2 controller properties for explicit loss/fee/dashboard config.
 * Equivalent to former "standard" type: merchant controls their own Stripe dashboard.
 */
export async function createConnectAccount(
  merchantEmail: string,
  merchantName: string,
  merchantId: string,
): Promise<{ accountId: string; onboardingUrl: string }> {
  const account = await stripe.accounts.create({
    email: merchantEmail,
    business_profile: {
      name: merchantName,
      mcc: "7230", // Barber and beauty shops
    },
    controller: {
      stripe_dashboard: { type: "full" },
      losses: { payments: "stripe" },
      fees: { payer: "account" },
    },
    metadata: { source: "plan-saas", merchant_id: merchantId },
  }, {
    idempotencyKey: `connect_${merchantId}`,
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
