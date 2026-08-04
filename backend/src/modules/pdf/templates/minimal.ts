import type { InvoiceDocument } from "../../../database/models/Invoice.js";
import type { CustomerDocument } from "../../../database/models/Customer.js";

function esc(str: string | undefined): string {
  if (!str) return "";
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(date);
}

function formatCurrency(amount: number, currency: string): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
  }).format(amount);
}

/**
 * Minimal template: stripped-back monochrome layout focused on the numbers.
 */
export function renderMinimal(invoice: InvoiceDocument, customer: CustomerDocument): string {
  const itemRows = invoice.items
    .map(
      (item) => `
    <tr>
      <td style="padding: 12px 0;">${esc(item.description)}</td>
      <td style="padding: 12px 0; text-align: right; color: #999;">${item.quantity} × ${formatCurrency(item.unitPrice, invoice.currency)}</td>
      <td style="padding: 12px 0; text-align: right;">${formatCurrency(item.total, invoice.currency)}</td>
    </tr>
  `
    )
    .join("");

  const taxRows = invoice.taxComponents
    .map(
      (tc) => `
    <tr>
      <td colspan="2" style="padding: 4px 0; text-align: right; color: #999;">${esc(tc.name)} (${tc.rate}%)</td>
      <td style="padding: 4px 0; text-align: right;">${formatCurrency(tc.amount, invoice.currency)}</td>
    </tr>
  `
    )
    .join("");

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Invoice ${esc(invoice.invoiceNumber)}</title>
</head>
<body style="font-family: 'Helvetica Neue', Arial, sans-serif; margin: 0; padding: 60px; color: #000; font-size: 14px;">
  <div style="max-width: 700px; margin: 0 auto;">
    <div style="display: flex; justify-content: space-between; align-items: baseline; border-bottom: 1px solid #000; padding-bottom: 16px;">
      <h1 style="font-size: 20px; margin: 0; font-weight: 400; letter-spacing: 0.1em;">INVOICE</h1>
      <span style="color: #999;">${esc(invoice.invoiceNumber)}</span>
    </div>

    <div style="display: flex; justify-content: space-between; margin-top: 32px; color: #666;">
      <div>
        <p style="margin: 0;">${esc(customer.name)}</p>
        ${customer.email ? `<p style="margin: 2px 0 0 0;">${esc(customer.email)}</p>` : ""}
      </div>
      <div style="text-align: right;">
        <p style="margin: 0;">${formatDate(invoice.issuedAt)}</p>
        <p style="margin: 2px 0 0 0;">Due ${formatDate(invoice.dueDate)}</p>
      </div>
    </div>

    <table style="width: 100%; border-collapse: collapse; margin-top: 40px;">
      <tbody>
        ${itemRows}
      </tbody>
    </table>

    <div style="margin-top: 24px; border-top: 1px solid #ddd; padding-top: 16px;">
      <table style="width: 100%;">
        <tr>
          <td colspan="2" style="padding: 4px 0; text-align: right; color: #999;">Subtotal</td>
          <td style="padding: 4px 0; text-align: right;">${formatCurrency(invoice.subtotal, invoice.currency)}</td>
        </tr>
        ${taxRows}
        ${
          invoice.discount > 0
            ? `<tr>
          <td colspan="2" style="padding: 4px 0; text-align: right; color: #999;">Discount</td>
          <td style="padding: 4px 0; text-align: right;">-${formatCurrency(invoice.discount, invoice.currency)}</td>
        </tr>`
            : ""
        }
        <tr>
          <td colspan="2" style="padding: 12px 0 0 0; text-align: right; font-weight: 700; font-size: 16px;">Total</td>
          <td style="padding: 12px 0 0 0; text-align: right; font-weight: 700; font-size: 16px;">${formatCurrency(invoice.total, invoice.currency)}</td>
        </tr>
      </table>
    </div>

    ${invoice.notes ? `<p style="margin-top: 40px; color: #999; line-height: 1.6; white-space: pre-wrap;">${esc(invoice.notes)}</p>` : ""}
  </div>
</body>
</html>
  `.trim();
}
