import { reminderQueue } from "./queues.js";
import { logger } from "../observability/logger.js";
import {
  REMINDER_SWEEP_CRON,
  REMINDER_SWEEP_JOB_NAME,
  REMINDER_SWEEP_SCHEDULER_ID,
} from "../modules/reminders/reminders.types.js";

/**
 * Registers (or updates) the daily reminder sweep as a BullMQ Job Scheduler.
 *
 * `upsertJobScheduler` is idempotent by scheduler id: starting the worker
 * process any number of times leaves exactly one schedule, and changing the cron
 * expression updates the existing one in place rather than stacking a second.
 * The schedule itself is persisted in Redis, so it survives worker restarts.
 *
 * `tz: "UTC"` pins evaluation to UTC — the same reasoning as the offset math in
 * reminders.schedule.ts: no DST drift, the sweep fires at one predictable instant.
 */
export async function scheduleReminderSweep(): Promise<void> {
  await reminderQueue.upsertJobScheduler(
    REMINDER_SWEEP_SCHEDULER_ID,
    { pattern: REMINDER_SWEEP_CRON, tz: "UTC" },
    {
      name: REMINDER_SWEEP_JOB_NAME,
      // The sweep is inherently idempotent (see runOverdueSweep / the milestone
      // guard in recordAndQueueReminder), so a completed run can be dropped and a
      // handful of failures retained for inspection.
      opts: { removeOnComplete: true, removeOnFail: 50 },
    }
  );

  logger.info(
    { cron: REMINDER_SWEEP_CRON, schedulerId: REMINDER_SWEEP_SCHEDULER_ID },
    "Daily reminder sweep scheduled"
  );
}
