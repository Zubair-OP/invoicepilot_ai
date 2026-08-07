import rateLimit, { type Options, type Store, type IncrementResponse } from "express-rate-limit";
import IORedis, { type Redis } from "ioredis";
import type { Request } from "express";
import { env } from "../../config/env.js";
import { logger } from "../../observability/logger.js";

/**
 * Redis-backed rate limiting with per-route tiers.
 *
 * The previous single limiter (100 req/15 min per IP, in-memory) applied the
 * same budget to `/health` and AI generation — too loose for expensive routes,
 * too tight for cheap ones — and its in-memory store reset on every deploy and
 * did not work across instances. This module replaces it with:
 *
 *   - `apiLimiter`   — a per-IP safety net for the whole API surface.
 *   - `strictLimiter`  — per-tenant budget for expensive/auth-adjacent routes
 *                        (AI, email, PDF, writes), keyed by `userId`.
 *   - `generousLimiter` — per-tenant budget for cheap read routes.
 *
 * Keys are anchored in the same shared Redis the cache uses, so limits survive
 * restarts and hold across multiple instances. When Redis is unavailable the
 * limiter fails open (`passOnStoreError`) — a rate-limit outage must not take
 * the whole API down, mirroring the cache layer's fail-open behaviour.
 */

const RATE_LIMIT_NAMESPACE = "rl:";

// Atomic fixed-window increment: bump the count and only attach the window TTL
// on the first hit, so the window is anchored rather than sliding on every
// request. Returns { count, remainingTtlMs }.
const INCR_SCRIPT = `
local count = redis.call('INCR', KEYS[1])
if count == 1 then
  redis.call('PEXPIRE', KEYS[1], ARGV[1])
end
local ttl = redis.call('PTTL', KEYS[1])
return { count, ttl }
`;

const RATE_LIMIT_MESSAGE = { success: false, message: "Too many requests", code: "RATE_LIMIT_EXCEEDED" };

const STORE_UNKNOWN_KEY_COOLDOWN_MS = 30_000;

export class RedisRateLimitStore implements Store {
  readonly localKeys = false;
  readonly prefix: string;
  private client: Redis;
  private windowMs = 60_000;
  private unavailableUntil = 0;

  constructor(prefix: string) {
    this.prefix = prefix;
    this.client = new IORedis({
      host: env.REDIS_HOST,
      port: env.REDIS_PORT,
      password: env.REDIS_PASSWORD || undefined,
      lazyConnect: true,
      enableOfflineQueue: false,
      maxRetriesPerRequest: 1,
      connectTimeout: 2000,
    });
  }

  init(options: Options): void {
    this.windowMs = options.windowMs;
  }

  private fullKey(key: string): string {
    return `${RATE_LIMIT_NAMESPACE}${this.prefix}${key}`;
  }

  /** Connects lazily. Throws when Redis is down so `passOnStoreError` can fail open. */
  private async connect(): Promise<void> {
    if (Date.now() < this.unavailableUntil) {
      throw new Error("rate limit store unavailable");
    }
    if (this.client.status === "ready") return;

    try {
      await this.client.connect();
    } catch (error) {
      this.unavailableUntil = Date.now() + STORE_UNKNOWN_KEY_COOLDOWN_MS;
      throw error;
    }
  }

  async increment(key: string): Promise<IncrementResponse> {
    await this.connect();
    const [count, ttlMs] = (await this.client.eval(
      INCR_SCRIPT,
      1,
      this.fullKey(key),
      this.windowMs
    )) as [number, number];
    return { totalHits: count, resetTime: new Date(Date.now() + ttlMs) };
  }

  async decrement(key: string): Promise<void> {
    try {
      await this.connect();
      const remaining = await this.client.decr(this.fullKey(key));
      if (remaining <= 0) await this.client.del(this.fullKey(key));
    } catch (error) {
      logger.warn({ err: error }, "Rate limit store decrement failed");
    }
  }

  async resetKey(key: string): Promise<void> {
    try {
      await this.connect();
      await this.client.del(this.fullKey(key));
    } catch (error) {
      logger.warn({ err: error }, "Rate limit store reset failed");
    }
  }

  async resetAll(): Promise<void> {
    try {
      await this.connect();
      let cursor = "0";
      do {
        const [next, keys] = await this.client.scan(
          cursor,
          "MATCH",
          `${RATE_LIMIT_NAMESPACE}${this.prefix}*`,
          "COUNT",
          200
        );
        cursor = next;
        if (keys.length > 0) await this.client.del(...keys);
      } while (cursor !== "0");
    } catch (error) {
      logger.warn({ err: error }, "Rate limit store resetAll failed");
    }
  }

  shutdown(): void {
    this.client.disconnect();
  }
}

const stores: RedisRateLimitStore[] = [];

function makeStore(prefix: string): RedisRateLimitStore {
  const store = new RedisRateLimitStore(prefix);
  stores.push(store);
  return store;
}

function closeStores(): void {
  for (const store of stores) store.shutdown();
}

/**
 * Key generator. Prefers the authenticated tenant id so an IP cannot borrow a
 * shared quota (and a shared NAT cannot exhaust one tenant's budget); falls back
 * to the IP for public routes. Must run after `authenticate` on protected routes.
 */
function keyForRequest(req: Request): string {
  return req.user?.userId ?? req.ip ?? "anonymous";
}

const BASE_OPTIONS: Partial<Options> = {
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: RATE_LIMIT_MESSAGE,
  // Redis outage → let the request through rather than erroring the API.
  passOnStoreError: true,
};

/** Default per-IP safety net for the whole API surface. */
export const apiLimiter = rateLimit({
  ...BASE_OPTIONS,
  windowMs: 15 * 60 * 1000,
  limit: 300,
  keyGenerator: (req: Request) => req.ip ?? "anonymous",
  store: makeStore("api:"),
});

/** Strict per-tenant budget for expensive / auth-adjacent routes (AI, email, PDF, writes). */
export const strictLimiter = rateLimit({
  ...BASE_OPTIONS,
  windowMs: 5 * 60 * 1000,
  limit: 100,
  keyGenerator: keyForRequest,
  store: makeStore("strict:"),
});

/** Generous per-tenant budget for cheap read routes (lists, dashboards, templates). */
export const generousLimiter = rateLimit({
  ...BASE_OPTIONS,
  windowMs: 15 * 60 * 1000,
  limit: 500,
  keyGenerator: keyForRequest,
  store: makeStore("generous:"),
});

export function closeRateLimitStore(): void {
  closeStores();
}
