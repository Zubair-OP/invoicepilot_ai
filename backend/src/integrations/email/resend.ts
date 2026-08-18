import { Resend } from "resend";
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

// Lazily constructed so importing this module never requires the key. When the
// key is absent the client stays null and sends become no-op stubs.
let client: Resend | null = null;

function getClient(): Resend | null {
  if (!env.RESEND_API_KEY) return null;
  client ??= new Resend(env.RESEND_API_KEY);
  return client;
}

/**
 * Sends one email through Resend. When `RESEND_API_KEY` is unset the send is
 * logged and skipped rather than throwing — so local development and CI work
 * without a real provider, while production still delivers.
 *
 * Throws on a real provider error so the caller (the BullMQ worker) can retry.
 * `EMAIL_FROM` must be an address on a Resend-verified domain.
 */
export async function sendEmail(params: SendEmailParams): Promise<void> {
  const resend = getClient();

  if (!resend) {
    logger.info(
      { to: params.to, subject: params.subject, attachments: params.attachments?.length ?? 0 },
      "[Email Stub] RESEND_API_KEY unset — email not sent"
    );
    return;
  }

  if (!env.EMAIL_FROM) {
    logger.info(
      { to: params.to, subject: params.subject },
      "[Email Stub] EMAIL_FROM unset - Resend email not sent"
    );
    return;
  }

  const { data, error } = await resend.emails.send({
    from: env.EMAIL_FROM,
    to: params.to,
    subject: params.subject,
    html: params.html,
    text: params.text,
    attachments: params.attachments?.map((a) => ({ filename: a.filename, content: a.content })),
  });

  if (error) {
    // Surface as a thrown error so BullMQ's retry/backoff kicks in.
    throw new Error(`Resend send failed: ${error.message}`);
  }

  logger.info({ to: params.to, id: data?.id }, "Email sent");
}
