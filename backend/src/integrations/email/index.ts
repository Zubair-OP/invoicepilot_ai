import { sendEmail as sendNodemailer, type SendEmailParams, type EmailAttachment } from "./nodemailer.js";
import { sendEmail as sendBrevo } from "./brevo.js";
import { env } from "../../config/env.js";

/**
 * Dispatches one email to the best available transport:
 * 1. The user's own SMTP configuration (if they configured one) — full control.
 * 2. Brevo's HTTP API when a key is set. Render's free tier blocks outbound
 *    SMTP ports, so Brevo (port 443) is the production path.
 * 3. The platform Nodemailer/SMTP setup as the final fallback.
 */
export async function sendEmail(params: SendEmailParams): Promise<void> {
  if (params.customSmtp?.user && params.customSmtp?.pass) {
    return sendNodemailer(params);
  }
  if (env.BREVO_API_KEY) {
    return sendBrevo(params);
  }
  return sendNodemailer(params);
}

export type { SendEmailParams, EmailAttachment };
export {
  renderEmail,
  paymentFailedEmail,
  type InvoiceEmailData,
  type PaymentFailedEmailData,
  type RenderedEmail,
} from "./templates/index.js";
