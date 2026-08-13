export { sendEmail, type SendEmailParams, type EmailAttachment } from "./nodemailer.js";
export {
  renderEmail,
  paymentFailedEmail,
  type InvoiceEmailData,
  type PaymentFailedEmailData,
  type RenderedEmail,
} from "./templates/index.js";
