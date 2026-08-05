import type { EmailType } from "../../common/types/index.js";

// Payload carried through the BullMQ email queue. Kept to plain, serializable
// scalars — the worker re-loads the invoice from Mongo at send time, so nothing
// large or stale travels through Redis.
export interface EmailJobData {
  userId: string;
  invoiceId: string;
  type: EmailType;
  to: string;
  subject?: string;
  message?: string;
}

export const EMAIL_QUEUE_JOB_NAME = "send-invoice-email";

/**
 * Deterministic job id: same invoice + type + recipient always maps to the same
 * id. BullMQ rejects a duplicate id while a job is queued/active, so a rapid
 * double-submit is de-duplicated. Completed jobs are removed, so a deliberate
 * later resend is allowed again.
 */
export function buildEmailJobId(invoiceId: string, type: EmailType, to: string): string {
  return `email:${invoiceId}:${type}:${to.toLowerCase()}`;
}
