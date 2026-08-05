import type { Job } from "bullmq";
import { Invoice, Customer, User } from "../../database/models/index.js";
import { NotFoundError } from "../../common/errors/index.js";
import { logger } from "../../observability/logger.js";
import { generateInvoicePDFForUser } from "../pdf/pdf.service.js";
import { sendEmail, renderEmail, type InvoiceEmailData } from "../../integrations/email/index.js";
import { logActivity } from "../activity/index.js";
import type { EmailJobData } from "./email.types.js";

/**
 * BullMQ job processor: renders the invoice PDF, builds the email from the
 * chosen template, and sends through Resend. On success, transitions DRAFT →
 * SENT (if applicable) and appends the delivery to `emailsSent[]`.
 *
 * The worker calls this with retry + exponential backoff, so transient provider
 * errors and cold Playwright renders recover without operator action.
 */
export async function processEmailJob(job: Job<EmailJobData>): Promise<void> {
  const { userId, invoiceId, type, to, subject, message } = job.data;

  logger.info({ jobId: job.id, invoiceId, type, to }, "Processing email job");

  // Re-load the invoice from the database — the queue only carries ids, so
  // edits made after enqueueing (e.g. notes updated) are always reflected.
  const invoice = await Invoice.findOne({ _id: invoiceId, userId });
  if (!invoice) throw new NotFoundError("Invoice");

  const customer = await Customer.findOne({ _id: invoice.customerId, userId });
  if (!customer) throw new NotFoundError("Customer");

  const user = await User.findOne({ _id: userId, deletedAt: { $exists: false } })
    .select("settings")
    .lean();
  const businessName = user?.settings?.businessName ?? "InvoicePilot";

  // Generate the PDF. This can take a few seconds on a cold Playwright browser,
  // which is why the send is async rather than inline in the controller.
  const { pdf } = await generateInvoicePDFForUser(userId, invoiceId);

  // Render the template. The caller can override subject but not the HTML body —
  // HTML lives in code, not user input, so there's no injection risk.
  const emailData: InvoiceEmailData = {
    businessName,
    customerName: customer.name,
    invoiceNumber: invoice.invoiceNumber,
    total: invoice.total,
    currency: invoice.currency,
    issuedAt: invoice.issuedAt,
    dueDate: invoice.dueDate,
    paidAt: invoice.paidAt,
    message,
  };

  const rendered = renderEmail(type, emailData);

  await sendEmail({
    to,
    subject: subject ?? rendered.subject,
    html: rendered.html,
    text: rendered.text,
    attachments: [{ filename: `${invoice.invoiceNumber}.pdf`, content: pdf }],
  });

  // Mark the invoice as sent if it was a draft and this is the initial invoice
  // send (not a reminder or receipt). The check is idempotent: re-sending an
  // already-SENT invoice leaves the status unchanged.
  if (type === "invoice" && invoice.status === "DRAFT") {
    invoice.status = "SENT";
  }

  // Append to the delivery log. This is append-only: resends and reminders add
  // new entries rather than updating an existing one, so the history is visible.
  invoice.emailsSent.push({ to, sentAt: new Date(), type });
  await invoice.save();

  // Best-effort activity log. Failures here must not fail the send.
  await logActivity({
    userId,
    action: "INVOICE_EMAIL_SENT",
    targetType: "Invoice",
    targetId: invoiceId,
    metadata: { type, to, invoiceNumber: invoice.invoiceNumber },
  });

  logger.info({ jobId: job.id, invoiceId, type, to }, "Email sent successfully");
}
