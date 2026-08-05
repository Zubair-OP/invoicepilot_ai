import {
  layout,
  esc,
  formatCurrency,
  formatDate,
  invoiceSummaryHtml,
  messageHtml,
  type InvoiceEmailData,
  type RenderedEmail,
} from "./shared.js";

/**
 * Payment reminder for an unpaid (or overdue) invoice. Reuses the same summary
 * block as the initial invoice; the framing differs so the recipient knows this
 * is a nudge, not a first send.
 */
export function reminderEmail(data: InvoiceEmailData): RenderedEmail {
  const subject = `Reminder: Invoice ${data.invoiceNumber} from ${data.businessName} is due`;

  const bodyHtml = `
    <p style="margin: 0 0 16px 0;">Hi ${esc(data.customerName)},</p>
    <p style="margin: 0 0 16px 0;">This is a friendly reminder that the invoice below is due on ${esc(formatDate(data.dueDate))}. A PDF copy is attached for your reference.</p>
    ${messageHtml(data.message)}
    ${invoiceSummaryHtml(data)}
    <p style="margin: 0; color: #777777; font-size: 14px;">If you have already paid, please disregard this message.</p>
  `;

  const html = layout({
    heading: "Payment reminder",
    preheader: `Invoice ${data.invoiceNumber} — ${formatCurrency(data.total, data.currency)} due ${formatDate(data.dueDate)}`,
    bodyHtml,
  });

  const text = [
    `Hi ${data.customerName},`,
    "",
    `This is a friendly reminder that invoice ${data.invoiceNumber} is due on ${formatDate(data.dueDate)}. A PDF copy is attached.`,
    data.message ? `\n${data.message}\n` : "",
    `Amount due: ${formatCurrency(data.total, data.currency)}`,
    "",
    "If you have already paid, please disregard this message.",
  ]
    .filter((line) => line !== "")
    .join("\n");

  return { subject, html, text };
}
