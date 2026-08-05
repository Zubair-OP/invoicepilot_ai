import { Queue } from "bullmq";
import IORedis from "ioredis";
import { env } from "../config/env.js";

// Shared connection options for every BullMQ Queue and Worker. `maxRetriesPerRequest:
// null` is required by BullMQ for blocking commands. Workers must not share a
// connection with queues (a blocking worker would stall queue operations), so
// each Worker builds its own IORedis from these options.
export const redisConnectionOptions = {
  host: env.REDIS_HOST,
  port: env.REDIS_PORT,
  password: env.REDIS_PASSWORD,
  maxRetriesPerRequest: null,
};

const connection = new IORedis(redisConnectionOptions);

export const emailQueue = new Queue("email", { connection });
export const invoiceQueue = new Queue("invoice", { connection });

// Carries the daily overdue/reminder sweep (Phase 7). The sweep is scheduled as a
// BullMQ Job Scheduler (see jobs/scheduler.ts) and consumed by the reminder
// worker in the dedicated worker process.
export const reminderQueue = new Queue("reminder", { connection });

export async function closeQueues() {
  await emailQueue.close();
  await invoiceQueue.close();
  await reminderQueue.close();
  await connection.quit();
}
