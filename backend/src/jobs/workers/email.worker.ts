import { Worker, type Worker as WorkerType } from "bullmq";
import IORedis from "ioredis";
import { redisConnectionOptions } from "../queues.js";
import { logger } from "../../observability/logger.js";
import { processEmailJob } from "../../modules/email/index.js";
import type { EmailJobData } from "../../modules/email/email.types.js";

// Concurrency is modest: each job renders a PDF (Playwright is memory-heavy, and
// pdf.service already caps concurrent renders at 3), so a small worker pool
// keeps memory bounded while still overlapping the network wait on Resend.
const EMAIL_WORKER_CONCURRENCY = 3;

let worker: WorkerType<EmailJobData> | null = null;
let connection: IORedis | null = null;

/**
 * Starts the in-process email worker. Phase 6 runs the worker inside the API
 * process for simplicity; Phase 7 will extract workers into a dedicated process.
 * Idempotent — calling twice returns the existing worker.
 */
export function startEmailWorker(): WorkerType<EmailJobData> {
  if (worker) return worker;

  connection = new IORedis(redisConnectionOptions);
  worker = new Worker<EmailJobData>("email", processEmailJob, {
    connection,
    concurrency: EMAIL_WORKER_CONCURRENCY,
  });

  worker.on("completed", (job) => {
    logger.info({ jobId: job.id }, "Email job completed");
  });

  worker.on("failed", (job, err) => {
    logger.error(
      { jobId: job?.id, attempts: job?.attemptsMade, err },
      "Email job failed"
    );
  });

  logger.info("Email worker started");
  return worker;
}

export async function stopEmailWorker(): Promise<void> {
  if (worker) {
    await worker.close();
    worker = null;
  }
  if (connection) {
    await connection.quit();
    connection = null;
  }
}
