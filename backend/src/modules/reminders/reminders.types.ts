// Queue + scheduler identifiers for the automated dunning sweep. The sweep takes
// no per-job payload — it scans every tenant's active invoices itself — so there
// is no job-data interface here, unlike the email queue.

// BullMQ queue name. Kept as a bare string literal to match the `email`/`invoice`
// queues declared in jobs/queues.ts.
export const REMINDER_QUEUE_NAME = "reminder";

// Name given to each sweep job the scheduler produces.
export const REMINDER_SWEEP_JOB_NAME = "reminder-sweep";

// Stable id for the repeatable Job Scheduler. `upsertJobScheduler` is keyed by
// this id, so re-running the worker never creates a second daily schedule.
export const REMINDER_SWEEP_SCHEDULER_ID = "daily-reminder-sweep";

// Daily at 08:00 UTC. Cron is evaluated in UTC (see scheduler.ts) so the sweep
// fires at the same instant regardless of server timezone or DST — the
// operational-safety requirement for Phase 7.
export const REMINDER_SWEEP_CRON = "0 8 * * *";
