import { Queue } from "bullmq";
import IORedis from "ioredis";
import { env } from "../config/env.js";

const connection = new IORedis({
  host: env.REDIS_HOST,
  port: env.REDIS_PORT,
  password: env.REDIS_PASSWORD,
  maxRetriesPerRequest: null,
});

export const emailQueue = new Queue("email", { connection });
export const invoiceQueue = new Queue("invoice", { connection });

export async function closeQueues() {
  await emailQueue.close();
  await invoiceQueue.close();
  await connection.quit();
}
