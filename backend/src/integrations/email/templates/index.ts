import type { EmailType } from "../../../common/types/index.js";
import type { InvoiceEmailData, RenderedEmail } from "./shared.js";
import { invoiceEmail } from "./invoiceEmail.js";
import { reminderEmail } from "./reminderEmail.js";
import { paymentReceivedEmail } from "./paymentReceivedEmail.js";

const TEMPLATES: Record<EmailType, (data: InvoiceEmailData) => RenderedEmail> = {
  invoice: invoiceEmail,
  reminder: reminderEmail,
  payment_received: paymentReceivedEmail,
};

/** Renders the email body for a given type. */
export function renderEmail(type: EmailType, data: InvoiceEmailData): RenderedEmail {
  return TEMPLATES[type](data);
}

export { invoiceEmail } from "./invoiceEmail.js";
export { reminderEmail } from "./reminderEmail.js";
export { paymentReceivedEmail } from "./paymentReceivedEmail.js";
export { paymentFailedEmail, type PaymentFailedEmailData } from "./paymentFailedEmail.js";
export type { InvoiceEmailData, RenderedEmail } from "./shared.js";
