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
    month: "long",
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
 * Modern template: clean sans-serif design with an accent color and generous spacing.
 */
export function renderModern(invoice: InvoiceDocument, customer: CustomerDocument): string {
  const itemRows = invoice.items
    .map(
      (item) => `
    <tr style="border-bottom: 1px solid #e5e7eb;">
      <td style="padding: 16px 8px;">${esc(item.description)}</td>
      <td style="padding: 16px 8px; text-align: right;">${item.quantity}</td>
      <td style="padding: 16px 8px; text-align: right;">${formatCurrency(item.unitPrice, invoice.currency)}</td>
      <td style="padding: 16px 8px; text-align: right; font-weight: 600;">${formatCurrency(item.total, invoice.currency)}</td>
    </tr>
  `
    )
    .join("");

  const taxRows = invoice.taxComponents
    .map(
      (tc) => `
    <tr>
      <td colspan="3" style="padding: 8px; text-align: right;">${esc(tc.name)} (${tc.rate}%):</td>
      <td style="padding: 8px; text-align: right;">${formatCurrency(tc.amount, invoice.currency)}</td>
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
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; margin: 0; padding: 40px; color: #1f2937; background: #f9fafb;">
  <div style="max-width: 800px; margin: 0 auto; background: white; padding: 48px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
    <div style="border-left: 4px solid #3b82f6; padding-left: 16px; margin-bottom: 40px;">
      <h1 style="font-size: 32px; margin: 0; font-weight: 700; color: #3b82f6;">INVOICE</h1>
      <p style="font-size: 16px; color: #6b7280; margin: 4px 0 0 0;">${esc(invoice.invoiceNumber)}</p>
    </div>

    <div style="display: flex; justify-content: space-between; margin-bottom: 48px;">
      <div>
        <p style="margin: 0; font-size: 12px; text-transform: uppercase; color: #6b7280; letter-spacing: 0.05em;">Bill To</p>
        <p style="margin: 8px 0 0 0; font-weight: 600; font-size: 16px;">${esc(customer.name)}</p>
        ${customer.email ? `<p style="margin: 4px 0 0 0; color: #6b7280;">${esc(customer.email)}</p>` : ""}
        ${customer.address ? `<p style="margin: 4px 0 0 0; color: #6b7280; white-space: pre-wrap;">${esc(customer.address)}</p>` : ""}
      </div>
      <div style="text-align: right;">
        <p style="margin: 0; color: #6b7280;"><span style="font-weight: 600;">Issued:</span> ${formatDate(invoice.issuedAt)}</p>
        <p style="margin: 8px 0 0 0; color: #6b7280;"><span style="font-weight: 600;">Due:</span> ${formatDate(invoice.dueDate)}</p>
        <p style="margin: 8px 0 0 0;"><span style="display: inline-block; padding: 4px 12px; background: ${invoice.status === "PAID" ? "#10b981" : "#3b82f6"}; color: white; border-radius: 4px; font-size: 12px; font-weight: 600;">${esc(invoice.status)}</span></p>
      </div>
    </div>

    <table style="width: 100%; border-collapse: collapse; margin-bottom: 32px;">
      <thead>
        <tr style="border-bottom: 2px solid #e5e7eb;">
          <th style="padding: 16px 8px; text-align: left; font-size: 12px; text-transform: uppercase; color: #6b7280; letter-spacing: 0.05em;">Description</th>
          <th style="padding: 16px 8px; text-align: right; font-size: 12px; text-transform: uppercase; color: #6b7280; letter-spacing: 0.05em;">Qty</th>
          <th style="padding: 16px 8px; text-align: right; font-size: 12px; text-transform: uppercase; color: #6b7280; letter-spacing: 0.05em;">Price</th>
          <th style="padding: 16px 8px; text-align: right; font-size: 12px; text-transform: uppercase; color: #6b7280; letter-spacing: 0.05em;">Total</th>
        </tr>
      </thead>
      <tbody>
        ${itemRows}
      </tbody>
    </table>

    <div style="margin-left: auto; width: 320px; border-top: 2px solid #e5e7eb; padding-top: 16px;">
      <table style="width: 100%;">
        <tr>
          <td style="padding: 8px; color: #6b7280;">Subtotal:</td>
          <td style="padding: 8px; text-align: right;">${formatCurrency(invoice.subtotal, invoice.currency)}</td>
        </tr>
        ${taxRows}
        ${
          invoice.discount > 0
            ? `<tr>
          <td style="padding: 8px; color: #6b7280;">Discount:</td>
          <td style="padding: 8px; text-align: right; color: #10b981;">-${formatCurrency(invoice.discount, invoice.currency)}</td>
        </tr>`
            : ""
        }
        <tr style="border-top: 2px solid #3b82f6;">
          <td style="padding: 16px 8px; font-size: 18px; font-weight: 700;">Total:</td>
          <td style="padding: 16px 8px; font-size: 18px; font-weight: 700; text-align: right; color: #3b82f6;">${formatCurrency(invoice.total, invoice.currency)}</td>
        </tr>
      </table>
    </div>

    ${invoice.notes ? `<div style="margin-top: 48px; padding: 24px; background: #f3f4f6; border-radius: 8px;"><p style="margin: 0; color: #6b7280; line-height: 1.6; white-space: pre-wrap;">${esc(invoice.notes)}</p></div>` : ""}
  </div>
</body>
</html>
  `.trim();
}
