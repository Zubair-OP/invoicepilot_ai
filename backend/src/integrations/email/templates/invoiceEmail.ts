import {
  layout,
  esc,
  formatCurrency,
  invoiceSummaryHtml,
  messageHtml,
  formatDate,
  type InvoiceEmailData,
  type RenderedEmail,
} from "./shared.js";

/**
 * Initial invoice delivery. Sent when a customer first receives an invoice.
 * Returns HTML plus a plain-text fallback for clients that don't render HTML.
 */
export function invoiceEmail(data: InvoiceEmailData): RenderedEmail {
  const subject = `Invoice ${data.invoiceNumber} from ${data.businessName}`;

  const bodyHtml = `
    <p style="margin: 0 0 16px 0;">Hi ${esc(data.customerName)},</p>
    <p style="margin: 0 0 16px 0;">${esc(data.businessName)} has sent you an invoice. The details are below, and a PDF copy is attached.</p>
    ${messageHtml(data.message)}
    ${invoiceSummaryHtml(data)}
    <p style="margin: 0; color: #777777; font-size: 14px;">Thank you for your business.</p>
  `;

  const html = layout({
    heading: "You have a new invoice",
    preheader: `Invoice ${data.invoiceNumber} — ${formatCurrency(data.total, data.currency)} due ${formatDate(data.dueDate)}`,
    bodyHtml,
  });

  const text = [
    `Hi ${data.customerName},`,
    "",
    `${data.businessName} has sent you an invoice. A PDF copy is attached.`,
    data.message ? `\n${data.message}\n` : "",
    `Invoice: ${data.invoiceNumber}`,
    `Amount due: ${formatCurrency(data.total, data.currency)}`,
    `Due date: ${formatDate(data.dueDate)}`,
    "",
    "Thank you for your business.",
  ]
    .filter((line) => line !== "")
    .join("\n");

  return { subject, html, text };
}
