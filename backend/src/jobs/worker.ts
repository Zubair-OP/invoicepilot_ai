import { connectDatabase, disconnectDatabase } from "../database/client.js";
import { logger } from "../observability/logger.js";
import { closeRedisCache } from "../common/cache/redis.js";
import { closeBrowser } from "../modules/pdf/index.js";
import { closeQueues } from "./queues.js";
import { startEmailWorker, stopEmailWorker } from "./workers/email.worker.js";
import { startReminderWorker, stopReminderWorker } from "./workers/reminder.worker.js";
import { scheduleReminderSweep } from "./scheduler.js";

// Dedicated worker process. Runs the BullMQ workers (email delivery + the daily
// reminder sweep) OUT of the API process, so a crash in a job can never take down
// the HTTP server and the two can scale independently. In production BOTH this
// process (`npm run worker`) and the API (`npm start`) must run — see README.
//
// The email worker renders PDFs with Playwright, so the shared browser lives and
// is torn down here as well as in the API.

async function main() {
  await connectDatabase();

  startEmailWorker();
  startReminderWorker();
  await scheduleReminderSweep();

  logger.info("Worker process started (email + reminder)");
}

main().catch((err) => {
  logger.fatal(err, "Failed to start worker process");
  process.exit(1);
});

let shuttingDown = false;
async function shutdown(signal: string) {
  if (shuttingDown) return;
  shuttingDown = true;

  logger.info({ signal }, "Worker shutting down...");
  await stopEmailWorker();
  await stopReminderWorker();
  await closeQueues();
  await closeBrowser();
  await closeRedisCache();
  await disconnectDatabase();
  process.exit(0);
}

process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("SIGINT", () => void shutdown("SIGINT"));
