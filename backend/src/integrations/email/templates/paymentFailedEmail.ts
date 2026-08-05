import { layout, esc, formatCurrency } from "./shared.js";
import type { RenderedEmail } from "./shared.js";

export interface PaymentFailedEmailData {
  businessName: string;
  /** Amount the card failed to collect, if the invoice carries it. */
  amount?: number;
  currency?: string;
}

/**
 * Sent to the subscriber when their Stripe subscription payment fails and the
 * subscription moves to `past_due`. Kept separate from the invoice templates —
 * it is an account-level notice, not an invoice email, so it takes its own data
 * shape instead of `InvoiceEmailData`.
 */
export function paymentFailedEmail(data: PaymentFailedEmailData): RenderedEmail {
  const amountText = data.amount !== undefined && data.currency
    ? formatCurrency(data.amount, data.currency)
    : "your subscription fee";

  const bodyHtml = `
    <p style="margin: 0 0 16px 0;">We couldn't charge your card for <strong>${esc(amountText)}</strong>.</p>
    <p style="margin: 0 0 16px 0;">Your subscription is now marked <strong>past due</strong> — no data has been lost and you can keep using the app, but new-record limits are enforced until the payment succeeds.</p>
    <p style="margin: 0 0 16px 0;">Update your payment method from the billing portal to restore your plan immediately.</p>
    <p style="margin: 0;">— The ${esc(data.businessName)} team</p>
  `;

  const html = layout({
    heading: "Payment failed",
    preheader: `We couldn't charge your card for ${amountText}.`,
    bodyHtml,
  });

  const text = [
    `Hi,`,
    "",
    `We couldn't charge your card for ${amountText}.`,
    "Your subscription is now marked past due — no data has been lost and you can keep using the app, but new-record limits are enforced until the payment succeeds.",
    "Update your payment method from the billing portal to restore your plan immediately.",
    "",
    `— The ${data.businessName} team`,
  ].join("\n");

  return { subject: "Payment failed — your InvoicePilot subscription is past due", html, text };
}
