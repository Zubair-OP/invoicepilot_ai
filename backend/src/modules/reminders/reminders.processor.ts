import { logger } from "../../observability/logger.js";
import { runOverdueSweep, runReminderSweep } from "./reminders.service.js";
import type { OverdueSweepResult, ReminderSweepSummary } from "./reminders.service.js";

export type ReminderSweepReport = OverdueSweepResult & ReminderSweepSummary;

/**
 * The unit of work behind the daily reminder job. Runs in two phases against a
 * single `now` so both phases agree on what "past due" means:
 *
 *  1. Overdue sweep — flip issued-but-unpaid invoices past their due date to
 *     OVERDUE. Done first so statuses are current before reminders are chosen.
 *  2. Reminder sweep — queue at most one due milestone per active invoice.
 *
 * Both phases are idempotent, so a re-run (BullMQ retry, or the operator kicking
 * the job manually) never marks or dunns anything twice. A one-line summary is
 * logged per run: scanned / marked overdue / queued / skipped.
 */
export async function processReminderSweep(): Promise<ReminderSweepReport> {
  const now = new Date();

  const overdue = await runOverdueSweep(now);
  const reminders = await runReminderSweep(now);

  const report: ReminderSweepReport = { ...overdue, ...reminders };
  logger.info(report, "Reminder sweep job finished");
  return report;
}
