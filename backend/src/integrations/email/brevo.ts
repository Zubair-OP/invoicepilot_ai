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
  fromName?: string;
  fromEmail?: string;
  replyTo?: string;
  attachments?: EmailAttachment[];
  customSmtp?: {
    host?: string;
    port?: number;
    user?: string;
    pass?: string;
  };
}

interface BrevoPayload {
  sender: { name: string; email: string };
  to: Array<{ email: string }>;
  subject: string;
  htmlContent: string;
  textContent?: string;
  replyTo?: { email: string; name: string };
  attachment?: Array<{ content: string; name: string }>;
}

interface BrevoResponse {
  messageId?: string;
  message?: string;
}

/**
 * Sends one email through Brevo's HTTP API. Render's free tier blocks outbound
 * SMTP ports (25/465/587), so transactional email must go over the HTTP API
 * (port 443) instead of Nodemailer. `BREVO_SENDER_EMAIL` must be a verified
 * sender inside the Brevo account.
 *
 * When the key is unset the send is logged and skipped rather than throwing, so
 * local development and CI work without a real provider. Real provider errors
 * are thrown so the BullMQ worker can retry with backoff.
 */
export async function sendEmail(params: SendEmailParams): Promise<void> {
  if (!env.BREVO_API_KEY || !env.BREVO_SENDER_EMAIL) {
    logger.info(
      { to: params.to, subject: params.subject, attachments: params.attachments?.length ?? 0 },
      "[Email Stub] BREVO_API_KEY / BREVO_SENDER_EMAIL unset — email not sent"
    );
    return;
  }

  const senderName = params.fromName || env.BREVO_SENDER_NAME || "InvoicePilot";

  const payload: BrevoPayload = {
    sender: { name: senderName, email: env.BREVO_SENDER_EMAIL },
    to: [{ email: params.to }],
    subject: params.subject,
    htmlContent: params.html,
  };

  if (params.text) payload.textContent = params.text;
  if (params.replyTo) {
    // The processor sends a formatted string: "Name" <email@host.com>
    // Brevo expects a plain object { email, name }.
    const quoted = params.replyTo.match(/^"?([^"<]+)"?\s*<([^>]+)>$/);
    payload.replyTo = {
      email: quoted?.[2] ?? params.replyTo,
      name: quoted?.[1]?.trim() || senderName,
    };
  }
  if (params.attachments?.length) {
    payload.attachment = params.attachments.map((a) => ({
      content: a.content.toString("base64"),
      name: a.filename,
    }));
  }

  const response = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: {
      "api-key": env.BREVO_API_KEY,
      "content-type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Brevo send failed (${response.status}): ${body.slice(0, 300)}`);
  }

  const data = (await response.json()) as BrevoResponse;
  logger.info({ to: params.to, messageId: data.messageId }, "Email sent via Brevo");
}