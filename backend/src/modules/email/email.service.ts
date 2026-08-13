import { Invoice, Customer } from "../../database/models/index.js";
import { NotFoundError, ValidationError } from "../../common/errors/index.js";
import { emailQueue } from "../../jobs/queues.js";
import { logger } from "../../observability/logger.js";
import type { EmailType } from "../../common/types/index.js";
import { EMAIL_QUEUE_JOB_NAME, buildEmailJobId, type EmailJobData } from "./email.types.js";
import type { SendEmailInput } from "./email.validation.js";

// Retry the whole send 3 times with exponential backoff. A transient provider
// blip (or a cold Playwright render) recovers without operator action; a
// persistent failure surfaces after the third attempt.
//
// Both completed and permanently-failed jobs are removed from Redis. Removal is
// what makes idempotency work *and* still allows a later resend: while a job is
// queued/active its id de-duplicates rapid double-submits, but once it settles
// the id frees up so a deliberate resend enqueues fresh. Failure details are
// logged to Pino by the worker, so dropping the failed job loses no diagnostics.
const EMAIL_JOB_OPTS = {
  attempts: 3,
  backoff: { type: "exponential" as const, delay: 5000 },
  removeOnComplete: true,
  removeOnFail: true,
};

export interface EnqueueResult {
  invoiceId: string;
  invoiceNumber: string;
  to: string;
  type: EmailType;
  queued: boolean;
}

/**
 * Queues an invoice email for delivery. Ownership is enforced here ({ _id,
 * userId }) before anything is enqueued, so a job never carries another tenant's
 * invoice. The recipient defaults to the customer's email when `to` is omitted.
 *
 * Sending is asynchronous: the actual render + provider call happens in the
 * email worker. This keeps the request fast and lets BullMQ own retries.
 */
export async function queueInvoiceEmail(
  userId: string,
  invoiceId: string,
  type: EmailType,
  input: SendEmailInput
): Promise<EnqueueResult> {
  const invoice = await Invoice.findOne({ _id: invoiceId, userId }).lean();
  if (!invoice) throw new NotFoundError("Invoice");

  const to = input.to ?? (await resolveCustomerEmail(userId, invoice.customerId.toString()));
  if (!to) {
    throw new ValidationError({
      to: ["No recipient: provide `to` or set an email on the customer"],
    });
  }

  const jobData: EmailJobData = {
    userId,
    invoiceId,
    type,
    to,
    subject: input.subject,
    message: input.message,
  };

  const jobId = `${buildEmailJobId(invoiceId, type, to)}_${Date.now()}`;
  const job = await emailQueue.add(EMAIL_QUEUE_JOB_NAME, jobData, { ...EMAIL_JOB_OPTS, jobId });

  const queued = true;
  logger.info({ invoiceId, type, to, jobId, queued }, "Invoice email enqueued");

  return { invoiceId, invoiceNumber: invoice.invoiceNumber, to, type, queued };
}

async function resolveCustomerEmail(userId: string, customerId: string): Promise<string | undefined> {
  const customer = await Customer.findOne({ _id: customerId, userId }).select("email").lean();
  return customer?.email || undefined;
}
