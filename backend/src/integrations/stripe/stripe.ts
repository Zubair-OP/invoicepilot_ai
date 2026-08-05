import Stripe from "stripe";
import { env } from "../../config/env.js";
import type { PlanKey } from "../../common/types/index.js";

// Verified against the installed SDK: `stripe@17.7.0` pins its LatestApiVersion
// to "2025-02-24.acacia", which is what this project ships. No change needed.
export const stripe = env.STRIPE_SECRET_KEY
  ? new Stripe(env.STRIPE_SECRET_KEY, { apiVersion: "2025-02-24.acacia" })
  : null;

export async function createCheckoutSession(params: {
  customerId: string;
  invoiceId: string;
  amount: number;
  currency: string;
  email: string;
}) {
  if (!stripe) throw new Error("Stripe not configured");

  return stripe.checkout.sessions.create({
    payment_method_types: ["card"],
    line_items: [
      {
        price_data: {
          currency: params.currency.toLowerCase(),
          product_data: { name: `Invoice ${params.invoiceId}` },
          unit_amount: Math.round(params.amount * 100),
        },
        quantity: 1,
      },
    ],
    mode: "payment",
    customer_email: params.email,
    metadata: { invoiceId: params.invoiceId, customerId: params.customerId },
    // Success/cancel redirect back to the frontend, resolved from the validated
    // env object (never process.env — env.ts fails fast on bad config).
    success_url: `${env.CORS_ORIGIN}/invoices/${params.invoiceId}?payment=success`,
    cancel_url: `${env.CORS_ORIGIN}/invoices/${params.invoiceId}?payment=cancelled`,
  });
}

/** Starts a subscription Checkout session for a plan upgrade. */
export async function createPlanCheckoutSession(params: {
  customerId: string;
  userId: string;
  planKey: PlanKey;
  priceId: string;
}) {
  if (!stripe) throw new Error("Stripe not configured");

  return stripe.checkout.sessions.create({
    mode: "subscription",
    customer: params.customerId,
    line_items: [{ price: params.priceId, quantity: 1 }],
    metadata: { userId: params.userId, planKey: params.planKey },
    client_reference_id: params.userId,
    allow_promotion_codes: true,
    success_url: `${env.CORS_ORIGIN}/billing?checkout=success`,
    cancel_url: `${env.CORS_ORIGIN}/billing?checkout=cancelled`,
  });
}

/** Opens the Stripe Billing Portal for the tenant's subscription management. */
export async function createBillingPortalSession(params: { customerId: string }) {
  if (!stripe) throw new Error("Stripe not configured");

  return stripe.billingPortal.sessions.create({
    customer: params.customerId,
    return_url: `${env.CORS_ORIGIN}/billing`,
  });
}

export async function constructWebhookEvent(body: Buffer, signature: string) {
  if (!stripe || !env.STRIPE_WEBHOOK_SECRET) throw new Error("Stripe not configured");
  return stripe.webhooks.constructEvent(body, signature, env.STRIPE_WEBHOOK_SECRET);
}
