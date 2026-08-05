import type { EmailType } from "../../../common/types/index.js";

export interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
}

// Data every invoice email needs. Kept framework-free (plain values, not Mongoose
// documents) so templates are pure and trivially unit-testable.
export interface InvoiceEmailData {
  businessName: string;
  customerName: string;
  invoiceNumber: string;
  total: number;
  currency: string;
  issuedAt: Date;
  dueDate: Date;
  /** Optional custom note from the sender, shown above the invoice summary. */
  message?: string;
  /** Only meaningful for payment_received emails. */
  paidAt?: Date;
}

/**
 * Escapes HTML special characters. Customer names, business names, and sender
 * messages are user-controlled; unescaped values are an injection vector into
 * the email HTML. Every interpolated string in every template goes through this.
 */
export function esc(value: string | undefined): string {
  if (!value) return "";
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function formatCurrency(amount: number, currency: string): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(amount);
}

export function formatDate(date: Date): string {
  return new Intl.DateTimeFormat("en-US", { year: "numeric", month: "long", day: "numeric" }).format(date);
}

/**
 * Wraps body content in a responsive, inline-styled shell. Email clients strip
 * `<style>` blocks and external CSS, so all styling is inline and there are no
 * remote asset references.
 */
export function layout(options: { heading: string; preheader: string; bodyHtml: string }): string {
  const { heading, preheader, bodyHtml } = options;
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${esc(heading)}</title>
</head>
<body style="margin: 0; padding: 0; background: #f4f4f7; font-family: -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif; color: #2b2b2b;">
  <span style="display: none; max-height: 0; overflow: hidden;">${esc(preheader)}</span>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background: #f4f4f7; padding: 24px 0;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width: 600px; background: #ffffff; border-radius: 8px; overflow: hidden; border: 1px solid #e6e6e6;">
          <tr>
            <td style="background: #1a1a2e; padding: 24px 32px;">
              <h1 style="margin: 0; color: #ffffff; font-size: 22px;">${esc(heading)}</h1>
            </td>
          </tr>
          <tr>
            <td style="padding: 32px;">
              ${bodyHtml}
            </td>
          </tr>
          <tr>
            <td style="padding: 20px 32px; border-top: 1px solid #eeeeee; font-size: 12px; color: #999999;">
              Sent by InvoicePilot AI. This is an automated message.
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

/** Summary block reused across all invoice emails. */
export function invoiceSummaryHtml(data: InvoiceEmailData): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin: 24px 0; border: 1px solid #eeeeee; border-radius: 6px;">
    <tr>
      <td style="padding: 12px 16px; color: #777777; font-size: 14px;">Invoice</td>
      <td style="padding: 12px 16px; text-align: right; font-weight: 600;">${esc(data.invoiceNumber)}</td>
    </tr>
    <tr>
      <td style="padding: 12px 16px; color: #777777; font-size: 14px; border-top: 1px solid #f2f2f2;">Amount due</td>
      <td style="padding: 12px 16px; text-align: right; font-weight: 700; font-size: 18px; border-top: 1px solid #f2f2f2;">${esc(formatCurrency(data.total, data.currency))}</td>
    </tr>
    <tr>
      <td style="padding: 12px 16px; color: #777777; font-size: 14px; border-top: 1px solid #f2f2f2;">Due date</td>
      <td style="padding: 12px 16px; text-align: right; border-top: 1px solid #f2f2f2;">${esc(formatDate(data.dueDate))}</td>
    </tr>
  </table>`;
}

/** Renders an optional sender message as an escaped paragraph, or nothing. */
export function messageHtml(message?: string): string {
  if (!message) return "";
  return `<p style="margin: 0 0 16px 0; padding: 12px 16px; background: #f9f9fb; border-left: 3px solid #1a1a2e; white-space: pre-wrap;">${esc(message)}</p>`;
}

export const TEMPLATE_HEADINGS: Record<EmailType, string> = {
  invoice: "You have a new invoice",
  reminder: "Payment reminder",
  payment_received: "Payment received",
};
