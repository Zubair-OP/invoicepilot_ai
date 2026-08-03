import Stripe from "stripe";
import { env } from "../../config/env.js";

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
    success_url: `${process.env.CORS_ORIGIN}/invoices/${params.invoiceId}?payment=success`,
    cancel_url: `${process.env.CORS_ORIGIN}/invoices/${params.invoiceId}?payment=cancelled`,
  });
}

export async function constructWebhookEvent(body: Buffer, signature: string) {
  if (!stripe || !env.STRIPE_WEBHOOK_SECRET) throw new Error("Stripe not configured");
  return stripe.webhooks.constructEvent(body, signature, env.STRIPE_WEBHOOK_SECRET);
}
