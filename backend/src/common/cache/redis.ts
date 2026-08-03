import IORedis, { type Redis } from "ioredis";
import { z } from "zod";
import { env } from "../../config/env.js";
import { logger } from "../../observability/logger.js";
import type { RequestUser } from "../types/index.js";

const authCacheSchema = z.object({
  userId: z.string(),
  clerkId: z.string(),
  role: z.enum(["USER", "ADMIN"]),
});

let client: Redis | null = null;
let unavailableUntil = 0;

function createClient() {
  return new IORedis({
    host: env.REDIS_HOST,
    port: env.REDIS_PORT,
    password: env.REDIS_PASSWORD || undefined,
    lazyConnect: true,
    enableOfflineQueue: false,
    maxRetriesPerRequest: 1,
  });
}

async function getClient(): Promise<Redis | null> {
  if (Date.now() < unavailableUntil) return null;

  client ??= createClient();

  if (client.status === "ready") return client;

  try {
    await client.connect();
    return client;
  } catch (error) {
    unavailableUntil = Date.now() + 30_000;
    logger.warn({ err: error }, "Redis cache unavailable");
    return null;
  }
}

function markUnavailable(error: unknown) {
  unavailableUntil = Date.now() + 30_000;
  logger.warn({ err: error }, "Redis cache operation failed");
}

export async function cacheGetAuthUser(clerkId: string): Promise<RequestUser | null> {
  const redis = await getClient();
  if (!redis) return null;

  try {
    const value = await redis.get(`auth:user:${clerkId}`);
    if (!value) return null;

    const parsed: unknown = JSON.parse(value);
    const result = authCacheSchema.safeParse(parsed);
    return result.success ? result.data : null;
  } catch (error) {
    markUnavailable(error);
    return null;
  }
}

export async function cacheSetAuthUser(user: RequestUser): Promise<void> {
  const redis = await getClient();
  if (!redis) return;

  try {
    await redis.set(`auth:user:${user.clerkId}`, JSON.stringify(user), "EX", 300);
  } catch (error) {
    markUnavailable(error);
  }
}

export async function invalidateAuthUser(clerkId: string): Promise<void> {
  const redis = await getClient();
  if (!redis) return;

  try {
    await redis.del(`auth:user:${clerkId}`);
  } catch (error) {
    markUnavailable(error);
  }
}

export async function claimIdempotencyKey(key: string, ttlSeconds: number): Promise<boolean> {
  const redis = await getClient();
  if (!redis) return true;

  try {
    const result = await redis.set(`idempotency:${key}`, "1", "EX", ttlSeconds, "NX");
    return result === "OK";
  } catch (error) {
    markUnavailable(error);
    return true;
  }
}

export async function releaseIdempotencyKey(key: string): Promise<void> {
  const redis = await getClient();
  if (!redis) return;

  try {
    await redis.del(`idempotency:${key}`);
  } catch (error) {
    markUnavailable(error);
  }
}

export async function closeRedisCache(): Promise<void> {
  if (!client) return;
  await client.quit();
  client = null;
}
