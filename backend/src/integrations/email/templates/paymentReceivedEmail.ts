import {
  layout,
  esc,
  formatCurrency,
  formatDate,
  messageHtml,
  type InvoiceEmailData,
  type RenderedEmail,
} from "./shared.js";

/**
 * Payment confirmation / receipt. Sent after an invoice is marked paid. Shows a
 * paid summary rather than an amount-due summary.
 */
export function paymentReceivedEmail(data: InvoiceEmailData): RenderedEmail {
  const subject = `Payment received for Invoice ${data.invoiceNumber}`;
  const paidOn = data.paidAt ?? new Date();

  const bodyHtml = `
    <p style="margin: 0 0 16px 0;">Hi ${esc(data.customerName)},</p>
    <p style="margin: 0 0 16px 0;">We've received your payment for invoice ${esc(data.invoiceNumber)}. Thank you! A PDF copy is attached for your records.</p>
    ${messageHtml(data.message)}
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin: 24px 0; border: 1px solid #eeeeee; border-radius: 6px;">
      <tr>
        <td style="padding: 12px 16px; color: #777777; font-size: 14px;">Invoice</td>
        <td style="padding: 12px 16px; text-align: right; font-weight: 600;">${esc(data.invoiceNumber)}</td>
      </tr>
      <tr>
        <td style="padding: 12px 16px; color: #777777; font-size: 14px; border-top: 1px solid #f2f2f2;">Amount paid</td>
        <td style="padding: 12px 16px; text-align: right; font-weight: 700; font-size: 18px; color: #1b8a4b; border-top: 1px solid #f2f2f2;">${esc(formatCurrency(data.total, data.currency))}</td>
      </tr>
      <tr>
        <td style="padding: 12px 16px; color: #777777; font-size: 14px; border-top: 1px solid #f2f2f2;">Paid on</td>
        <td style="padding: 12px 16px; text-align: right; border-top: 1px solid #f2f2f2;">${esc(formatDate(paidOn))}</td>
      </tr>
    </table>
    <p style="margin: 0; color: #777777; font-size: 14px;">Thank you for your business.</p>
  `;

  const html = layout({
    heading: "Payment received",
    preheader: `Payment of ${formatCurrency(data.total, data.currency)} received for ${data.invoiceNumber}`,
    bodyHtml,
  });

  const text = [
    `Hi ${data.customerName},`,
    "",
    `We've received your payment for invoice ${data.invoiceNumber}. Thank you! A PDF copy is attached.`,
    data.message ? `\n${data.message}\n` : "",
    `Amount paid: ${formatCurrency(data.total, data.currency)}`,
    `Paid on: ${formatDate(paidOn)}`,
    "",
    "Thank you for your business.",
  ]
    .filter((line) => line !== "")
    .join("\n");

  return { subject, html, text };
}
