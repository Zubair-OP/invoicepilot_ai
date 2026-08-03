import { env } from "../../config/env.js";

interface SendEmailParams {
  to: string;
  subject: string;
  html: string;
}

export async function sendEmail({ to, subject, html }: SendEmailParams): Promise<void> {
  if (!env.RESEND_API_KEY) {
    console.log(`[Email Stub] To: ${to} | Subject: ${subject}`);
    return;
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: "InvoicePilot <noreply@invoicepilot.ai>",
      to: [to],
      subject,
      html,
    }),
  });

  if (!response.ok) {
    throw new Error(`Failed to send email: ${response.statusText}`);
  }
}

export async function sendInvoiceEmail(params: {
  to: string;
  customerName: string;
  invoiceNumber: string;
  total: number;
  currency: string;
  dueDate: Date;
  paymentLink?: string;
}): Promise<void> {
  const html = `
    <h2>Invoice ${params.invoiceNumber}</h2>
    <p>Dear ${params.customerName},</p>
    <p>Please find your invoice for <strong>${params.currency} ${params.total.toFixed(2)}</strong>.</p>
    <p>Due date: ${params.dueDate.toLocaleDateString()}</p>
    ${params.paymentLink ? `<p><a href="${params.paymentLink}">Pay Now</a></p>` : ""}
    <p>Thank you for your business!</p>
  `;

  await sendEmail({
    to: params.to,
    subject: `Invoice ${params.invoiceNumber} - Payment Due`,
    html,
  });
}
