import type { InvoiceDocument } from "../../../database/models/Invoice.js";
import type { CustomerDocument } from "../../../database/models/Customer.js";

/**
 * Escapes HTML special characters. Invoice notes, customer names, and business
 * names are user-controlled; unescaped HTML is an injection vector into the
 * renderer. This applies to every interpolated value in all three templates.
 */
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
 * Classic template: traditional layout with a bordered table and serif headings.
 * All CSS is inline (email clients strip `<style>`), and no network fetches occur
 * during render — a remote asset would make PDF generation depend on a third
 * party's uptime.
 */
export function renderClassic(invoice: InvoiceDocument, customer: CustomerDocument): string {
  const itemRows = invoice.items
    .map(
      (item) => `
    <tr>
      <td style="padding: 8px; border: 1px solid #ddd;">${esc(item.description)}</td>
      <td style="padding: 8px; border: 1px solid #ddd; text-align: right;">${item.quantity}</td>
      <td style="padding: 8px; border: 1px solid #ddd; text-align: right;">${formatCurrency(item.unitPrice, invoice.currency)}</td>
      <td style="padding: 8px; border: 1px solid #ddd; text-align: right;">${formatCurrency(item.total, invoice.currency)}</td>
    </tr>
  `
    )
    .join("");

  const taxRows = invoice.taxComponents
    .map(
      (tc) => `
    <tr>
      <td colspan="3" style="padding: 8px; text-align: right; font-weight: 600;">${esc(tc.name)} (${tc.rate}%):</td>
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
<body style="font-family: Georgia, serif; margin: 0; padding: 20px; color: #222;">
  <div style="max-width: 800px; margin: 0 auto;">
    <h1 style="font-size: 36px; margin-bottom: 4px;">INVOICE</h1>
    <p style="font-size: 18px; color: #666; margin-top: 0;">${esc(invoice.invoiceNumber)}</p>

    <div style="display: flex; justify-content: space-between; margin-top: 40px;">
      <div>
        <p style="margin: 0; font-weight: 600;">Bill To:</p>
        <p style="margin: 4px 0 0 0;">${esc(customer.name)}</p>
        ${customer.email ? `<p style="margin: 2px 0 0 0;">${esc(customer.email)}</p>` : ""}
        ${customer.address ? `<p style="margin: 2px 0 0 0; white-space: pre-wrap;">${esc(customer.address)}</p>` : ""}
      </div>
      <div style="text-align: right;">
        <p style="margin: 0;"><strong>Issued:</strong> ${formatDate(invoice.issuedAt)}</p>
        <p style="margin: 4px 0 0 0;"><strong>Due:</strong> ${formatDate(invoice.dueDate)}</p>
        <p style="margin: 4px 0 0 0;"><strong>Status:</strong> ${esc(invoice.status)}</p>
      </div>
    </div>

    <table style="width: 100%; margin-top: 40px; border-collapse: collapse;">
      <thead>
        <tr style="background: #f5f5f5;">
          <th style="padding: 12px 8px; border: 1px solid #ddd; text-align: left;">Description</th>
          <th style="padding: 12px 8px; border: 1px solid #ddd; text-align: right;">Qty</th>
          <th style="padding: 12px 8px; border: 1px solid #ddd; text-align: right;">Price</th>
          <th style="padding: 12px 8px; border: 1px solid #ddd; text-align: right;">Total</th>
        </tr>
      </thead>
      <tbody>
        ${itemRows}
      </tbody>
    </table>

    <div style="margin-top: 20px; text-align: right;">
      <table style="margin-left: auto; width: 300px;">
        <tr>
          <td style="padding: 8px; font-weight: 600;">Subtotal:</td>
          <td style="padding: 8px; text-align: right;">${formatCurrency(invoice.subtotal, invoice.currency)}</td>
        </tr>
        ${taxRows}
        ${
          invoice.discount > 0
            ? `<tr>
          <td style="padding: 8px; font-weight: 600;">Discount:</td>
          <td style="padding: 8px; text-align: right;">-${formatCurrency(invoice.discount, invoice.currency)}</td>
        </tr>`
            : ""
        }
        <tr style="border-top: 2px solid #222;">
          <td style="padding: 12px 8px; font-size: 18px; font-weight: 700;">Total:</td>
          <td style="padding: 12px 8px; font-size: 18px; font-weight: 700; text-align: right;">${formatCurrency(invoice.total, invoice.currency)}</td>
        </tr>
      </table>
    </div>

    ${invoice.notes ? `<div style="margin-top: 40px; padding: 16px; background: #f9f9f9; border-left: 4px solid #666;"><p style="margin: 0; white-space: pre-wrap;">${esc(invoice.notes)}</p></div>` : ""}
  </div>
</body>
</html>
  `.trim();
}
