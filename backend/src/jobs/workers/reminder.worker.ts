import { Worker, type Worker as WorkerType } from "bullmq";
import IORedis from "ioredis";
import { redisConnectionOptions } from "../queues.js";
import { logger } from "../../observability/logger.js";
import { processReminderSweep } from "../../modules/reminders/index.js";
import { REMINDER_QUEUE_NAME } from "../../modules/reminders/reminders.types.js";

// A single sweep at a time. Concurrency 1 means two sweeps can never overlap and
// race on the same invoice; the milestone guard in recordAndQueueReminder would
// still keep them correct, but serial execution keeps the summary logs clean and
// the load predictable.
const REMINDER_WORKER_CONCURRENCY = 1;

let worker: WorkerType | null = null;
let connection: IORedis | null = null;

/**
 * Starts the reminder worker. Runs in the dedicated worker process (jobs/worker.ts),
 * not the API — a crash in a sweep must not take down the HTTP server.
 * Idempotent: calling twice returns the existing worker.
 */
export function startReminderWorker(): WorkerType {
  if (worker) return worker;

  connection = new IORedis(redisConnectionOptions);
  worker = new Worker(REMINDER_QUEUE_NAME, async () => processReminderSweep(), {
    connection,
    concurrency: REMINDER_WORKER_CONCURRENCY,
  });

  worker.on("completed", (job) => {
    logger.info({ jobId: job.id }, "Reminder sweep completed");
  });

  worker.on("failed", (job, err) => {
    logger.error(
      { jobId: job?.id, attempts: job?.attemptsMade, err },
      "Reminder sweep failed"
    );
  });

  logger.info("Reminder worker started");
  return worker;
}

export async function stopReminderWorker(): Promise<void> {
  if (worker) {
    await worker.close();
    worker = null;
  }
  if (connection) {
    await connection.quit();
    connection = null;
  }
}
