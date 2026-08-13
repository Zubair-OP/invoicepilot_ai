import nodemailer from "nodemailer";
import { env } from "../../config/env.js";
import { logger } from "../../observability/logger.js";

export interface EmailAttachment {
  filename: string;
  content: Buffer;
}

export interface SendEmailParams {
  to: string;
  subject: string;
  html: string;
  text?: string;
  attachments?: EmailAttachment[];
}

// Lazily constructed transporter so importing this module never requires the
// SMTP credentials. When credentials are absent the send becomes a no-op stub.
let transporter: nodemailer.Transporter | null = null;

function getTransporter(): nodemailer.Transporter | null {
  if (!env.SMTP_USER || !env.SMTP_PASS) return null;
  if (transporter) return transporter;

  transporter = nodemailer.createTransport({
    host: env.SMTP_HOST ?? "smtp.gmail.com",
    port: Number(env.SMTP_PORT ?? 587),
    secure: false, // TLS via STARTTLS on port 587
    auth: {
      user: env.SMTP_USER,
      pass: env.SMTP_PASS,
    },
  });

  return transporter;
}

/**
 * Sends one email through Nodemailer (Gmail SMTP by default).
 * When SMTP_USER / SMTP_PASS are unset the send is logged and skipped —
 * local development works without real credentials.
 *
 * Throws on a real provider error so the BullMQ worker can retry.
 */
export async function sendEmail(params: SendEmailParams): Promise<void> {
  const transport = getTransporter();

  if (!transport) {
    logger.info(
      { to: params.to, subject: params.subject },
      "[Email Stub] SMTP credentials not set — email not sent"
    );
    return;
  }

  const info = await transport.sendMail({
    from: env.EMAIL_FROM ?? `"InvoicePilot" <${env.SMTP_USER}>`,
    to: params.to,
    subject: params.subject,
    html: params.html,
    text: params.text,
    attachments: params.attachments?.map((a) => ({
      filename: a.filename,
      content: a.content,
    })),
  });

  logger.info({ to: params.to, messageId: info.messageId }, "Email sent via Nodemailer");
}
