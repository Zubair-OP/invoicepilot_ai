import type { FilterQuery } from "mongoose";
import { Invoice, Customer, User } from "../../database/models/index.js";
import type { InvoiceDocument } from "../../database/models/index.js";
import { NotFoundError, RateLimitError, ValidationError } from "../../common/errors/index.js";
import { incrementRateLimit } from "../../common/cache/redis.js";
import { logger } from "../../observability/logger.js";
import { queueInvoiceEmail } from "../email/email.service.js";
import type { IReminderSettings } from "../../common/types/index.js";
import {
  DEFAULT_REMINDER_OFFSETS,
  selectDueReminder,
} from "./reminders.schedule.js";

// A single manual reminder every 20 minutes per invoice. Ad-hoc nudges are for
// exceptional follow-up, not a way to bypass the automated cadence — and the
// automated cadence is exactly what protects a customer from being dunned twice.
const MANUAL_REMINDER_LIMIT = 1;
const MANUAL_REMINDER_WINDOW_SECONDS = 20 * 60;

// Reminders only apply to invoices that are unpaid and have been issued. DRAFTs
// haven't been sent to anyone; PAID/CANCELLED are closed. This also drives the
// `{ status: 1, dueDate: 1 }` index.
const ACTIVE_STATUSES = ["SENT", "OVERDUE"] as const;

export interface OverdueSweepResult {
  markedOverdue: number;
}

export interface ReminderSweepSummary {
  scanned: number;
  remindersQueued: number;
  skippedNoEmail: number;
  skippedDisabled: number;
}

/**
 * Flips issued-but-unpaid invoices whose due date has passed to OVERDUE.
 *
 * A single `updateMany` is inherently idempotent: an invoice already OVERDUE
 * doesn't match `status: "SENT"`, so running the sweep twice in one day marks
 * nothing the second time. Comparison is against `now` (UTC) so there is no
 * timezone or DST ambiguity about when "past due" begins.
 */
export async function runOverdueSweep(now: Date): Promise<OverdueSweepResult> {
  const result = await Invoice.updateMany(
    { status: "SENT", dueDate: { $lt: now } },
    { $set: { status: "OVERDUE" } }
  );
  return { markedOverdue: result.modifiedCount };
}

// Default sweep interval for users who haven't set a custom one (matches old
// hardcoded */5 cron behaviour).
const DEFAULT_INTERVAL_MINUTES = 5;

/**
 * Scans active invoices and queues at most one reminder per invoice per run —
 * the milestone the invoice is currently due for (see `selectDueReminder`).
 *
 * Per-user interval gating:
 *  - Each user's `lastSweptAt` is compared against their `intervalMinutes`.
 *  - If the interval hasn't elapsed, the user's invoices are skipped entirely.
 *  - After processing, `lastSweptAt` is atomically updated on the User doc.
 *
 * Safety properties:
 *  - Streamed via a cursor, so memory stays flat regardless of tenant size.
 *  - The milestone is recorded in `remindersSent` with an atomic guarded update
 *    *before* the email is enqueued. Recording is the source of truth for "sent",
 *    so a crash after recording but before enqueuing loses a reminder rather than
 *    sending a duplicate — the correct trade-off for dunning.
 *  - Per-run caches for user settings and customer emails avoid re-querying the
 *    same tenant/customer across a batch.
 *  - Customers with no email are skipped with a warning, never failing the run.
 */
export async function runReminderSweep(now: Date): Promise<ReminderSweepSummary> {
  const summary: ReminderSweepSummary = {
    scanned: 0,
    remindersQueued: 0,
    skippedNoEmail: 0,
    skippedDisabled: 0,
  };

  const settingsCache = new Map<string, IReminderSettings>();
  const emailCache = new Map<string, string | null>();
  // Track which users have been interval-checked and whether they passed.
  const intervalCache = new Map<string, boolean>();

  const filter: FilterQuery<InvoiceDocument> = { status: { $in: ACTIVE_STATUSES } };
  const cursor = Invoice.find(filter)
    .select("userId customerId invoiceNumber status dueDate remindersSent")
    .lean()
    .cursor({ batchSize: 100 });

  // Users whose invoices were actually processed this run (need lastSweptAt update).
  const processedUserIds = new Set<string>();

  for await (const invoice of cursor) {
    summary.scanned += 1;

    const userId = invoice.userId.toString();

    // ── Per-user interval gating ──────────────────────────────
    let intervalAllowed = intervalCache.get(userId);
    if (intervalAllowed === undefined) {
      intervalAllowed = await isUserDueForSweep(userId, now);
      intervalCache.set(userId, intervalAllowed);
    }
    if (!intervalAllowed) continue;

    const settings = await resolveReminderSettings(userId, settingsCache);
    if (!settings.enabled) {
      summary.skippedDisabled += 1;
      continue;
    }

    const offsets = settings.offsets.length ? settings.offsets : DEFAULT_REMINDER_OFFSETS;
    const alreadySent = new Set((invoice.remindersSent ?? []).map((r) => r.type));
    const due = selectDueReminder(invoice.dueDate, offsets, alreadySent, now);
    if (!due) continue;

    const customerId = invoice.customerId.toString();
    const email = await resolveCustomerEmail(userId, customerId, emailCache);
    if (!email) {
      summary.skippedNoEmail += 1;
      logger.warn(
        { invoiceId: invoice._id.toString(), invoiceNumber: invoice.invoiceNumber, customerId },
        "Reminder skipped: customer has no email"
      );
      continue;
    }

    const queued = await recordAndQueueReminder(userId, invoice._id.toString(), due.type, email);
    if (queued) summary.remindersQueued += 1;
    processedUserIds.add(userId);
  }

  // Stamp `lastSweptAt` on every user we actually processed invoices for.
  if (processedUserIds.size > 0) {
    await User.updateMany(
      { _id: { $in: [...processedUserIds] } },
      { $set: { lastSweptAt: now } }
    );
  }

  logger.info({ ...summary }, "Reminder sweep complete");
  return summary;
}

/**
 * Checks whether enough time has elapsed since the user's last sweep, based on
 * their configured `intervalMinutes` (default 5). Returns `true` when the user
 * should be processed this run.
 */
async function isUserDueForSweep(userId: string, now: Date): Promise<boolean> {
  const user = await User.findOne({ _id: userId, deletedAt: { $exists: false } })
    .select("settings.reminders.intervalMinutes lastSweptAt")
    .lean();

  const intervalMinutes = user?.settings?.reminders?.intervalMinutes ?? DEFAULT_INTERVAL_MINUTES;
  const lastSweptAt = user?.lastSweptAt;

  // Never swept before — always process.
  if (!lastSweptAt) return true;

  const elapsedMs = now.getTime() - new Date(lastSweptAt).getTime();
  return elapsedMs >= intervalMinutes * 60 * 1000;
}

/**
 * Manually triggers a reminder for one invoice (POST /invoices/:id/remind).
 * Rate limited per invoice. Blocks closed invoices (PAID/CANCELLED) and drafts,
 * and requires a resolvable recipient. The send is recorded under the `manual`
 * milestone so it participates in the same append-only dunning history.
 */
export async function sendManualReminder(userId: string, invoiceId: string) {
  const invoice = await Invoice.findOne({ _id: invoiceId, userId })
    .select("status customerId invoiceNumber")
    .lean();
  if (!invoice) throw new NotFoundError("Invoice");

  if (invoice.status === "DRAFT") {
    throw new ValidationError({ status: ["Cannot remind on a draft invoice — send it first"] });
  }
  if (invoice.status === "PAID" || invoice.status === "CANCELLED") {
    throw new ValidationError({ status: [`Cannot remind on a ${invoice.status.toLowerCase()} invoice`] });
  }

  const email = await resolveCustomerEmail(userId, invoice.customerId.toString(), new Map());
  if (!email) {
    throw new ValidationError({
      to: ["No recipient: the customer has no email on file"],
    });
  }

  const { allowed } = await incrementRateLimit(
    `remind:${invoiceId}`,
    MANUAL_REMINDER_LIMIT,
    MANUAL_REMINDER_WINDOW_SECONDS
  );
  if (!allowed) {
    throw new RateLimitError("A reminder for this invoice was sent recently — try again later");
  }

  const type = "manual";
  const result = await queueInvoiceEmail(userId, invoiceId, "reminder", { to: email });

  // Manual reminders always send (no milestone de-dup): append the record after a
  // successful enqueue so the history reflects the nudge.
  await Invoice.updateOne(
    { _id: invoiceId, userId },
    { $push: { remindersSent: { type, sentAt: new Date() } }, $set: { lastReminderAt: new Date() } }
  );

  logger.info({ invoiceId, to: email }, "Manual reminder queued");
  return result;
}

/**
 * Atomically records a milestone and enqueues its email. The guarded update only
 * matches when the invoice is still active AND the milestone isn't already in
 * `remindersSent`, so two concurrent sweeps (or a sweep racing a manual send)
 * can never both record the same milestone — the database enforces send-once.
 * Returns true when this call is the one that recorded and enqueued.
 */
async function recordAndQueueReminder(
  userId: string,
  invoiceId: string,
  type: string,
  email: string
): Promise<boolean> {
  const updated = await Invoice.findOneAndUpdate(
    {
      _id: invoiceId,
      userId,
      status: { $in: ACTIVE_STATUSES },
      "remindersSent.type": { $ne: type },
    },
    { $push: { remindersSent: { type, sentAt: new Date() } }, $set: { lastReminderAt: new Date() } },
    { new: true }
  )
    .select("_id")
    .lean();

  // Lost the race, or the invoice was paid/cancelled between scan and update.
  if (!updated) return false;

  await queueInvoiceEmail(userId, invoiceId, "reminder", { to: email });
  return true;
}

async function resolveReminderSettings(
  userId: string,
  cache: Map<string, IReminderSettings>
): Promise<IReminderSettings> {
  const cached = cache.get(userId);
  if (cached) return cached;

  const user = await User.findOne({ _id: userId, deletedAt: { $exists: false } })
    .select("settings.reminders")
    .lean();

  const settings: IReminderSettings = user?.settings?.reminders ?? {
    enabled: true,
    offsets: DEFAULT_REMINDER_OFFSETS,
  };
  cache.set(userId, settings);
  return settings;
}

async function resolveCustomerEmail(
  userId: string,
  customerId: string,
  cache: Map<string, string | null>
): Promise<string | null> {
  const cached = cache.get(customerId);
  if (cached !== undefined) return cached;

  const customer = await Customer.findOne({ _id: customerId, userId }).select("email").lean();
  const email = customer?.email || null;
  cache.set(customerId, email);
  return email;
}
