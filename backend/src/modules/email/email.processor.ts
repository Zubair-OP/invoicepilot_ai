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

  try {
    // Re-load the invoice from the database
    const invoice = await Invoice.findOne({ _id: invoiceId, userId });
    if (!invoice) throw new NotFoundError("Invoice");

    const customer = await Customer.findOne({ _id: invoice.customerId, userId });
    if (!customer) throw new NotFoundError("Customer");

    const user = await User.findOne({ _id: userId, deletedAt: { $exists: false } })
      .select("name email settings")
      .lean();
    const businessName = user?.settings?.businessName || user?.name || "InvoicePilot";
    const businessEmail = user?.settings?.businessEmail || user?.email;

    logger.info({ jobId: job.id, invoiceId }, "Rendering invoice PDF for email attachment");
    const { pdf } = await generateInvoicePDFForUser(userId, invoiceId);
    logger.info({ jobId: job.id, pdfBytes: pdf.length }, "Invoice PDF rendered successfully");

    // Render the template
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

    logger.info({ jobId: job.id, to, businessName, businessEmail }, "Dispatching email to transport");
    await sendEmail({
      to,
      subject: subject ?? rendered.subject,
      html: rendered.html,
      text: rendered.text,
      fromName: businessName,
      fromEmail: businessEmail,
      replyTo: businessEmail ? `"${businessName}" <${businessEmail}>` : undefined,
      attachments: [{ filename: `${invoice.invoiceNumber}.pdf`, content: pdf }],
      customSmtp: user?.settings?.customSmtp,
    });

    if (type === "invoice" && invoice.status === "DRAFT") {
      invoice.status = "SENT";
    }

    invoice.emailsSent.push({ to, sentAt: new Date(), type });
    await invoice.save();

    await logActivity({
      userId,
      action: "INVOICE_EMAIL_SENT",
      targetType: "Invoice",
      targetId: invoiceId,
      metadata: { type, to, invoiceNumber: invoice.invoiceNumber },
    });

    logger.info({ jobId: job.id, invoiceId, type, to }, "Email job completed successfully");
  } catch (error) {
    logger.error({ jobId: job.id, invoiceId, type, to, err: error }, "Email job processing encountered error");
    throw error;
  }
}
