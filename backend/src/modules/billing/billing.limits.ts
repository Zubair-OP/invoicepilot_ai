import { Request, Response, NextFunction } from "express";
import { Invoice, Customer, User, AiUsage } from "../../database/models/index.js";
import { PaymentRequiredError } from "../../common/errors/index.js";
import { cacheGetInt, cacheSetInt, cacheIncrement, cacheDelete } from "../../common/cache/redis.js";
import { logger } from "../../observability/logger.js";
import type { PlanKey, PlanLimitResource } from "../../common/types/index.js";
import { getPlanByKey, FREE_PLAN } from "./plans.registry.js";

const USAGE_CACHE_TTL_SECONDS = 10 * 60;
const USAGE_CACHE_PREFIX = "usage:";

const ALL_RESOURCES: readonly PlanLimitResource[] = ["invoicesPerMonth", "customers", "aiGenerationsPerMonth"];

const RESOURCE_LABELS: Record<PlanLimitResource, string> = {
  invoicesPerMonth: "invoice",
  customers: "customer",
  aiGenerationsPerMonth: "AI generation",
};

function usageCacheKey(resource: PlanLimitResource, userId: string, periodStart: Date): string {
  return `${USAGE_CACHE_PREFIX}${resource}:${userId}:${periodStart.getTime()}`;
}

function startOfMonth(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
}

/**
 * Resolves the tenant's plan key and the start of their current usage window.
 * Subscribers use the Stripe billing period start; everyone else (free / no
 * active subscription) falls back to the start of the current calendar month so
 * limits reset on a stable boundary. All boundary math is UTC.
 */
async function getUsageContext(userId: string): Promise<{ planKey: PlanKey; periodStart: Date }> {
  const user = await User.findOne({ _id: userId, deletedAt: { $exists: false } })
    .select("subscription")
    .lean();
  const sub = user?.subscription;
  const now = new Date();
  const periodActive = sub?.currentPeriodEnd !== undefined && sub.currentPeriodEnd > now;
  const periodStart = periodActive && sub.currentPeriodStart ? new Date(sub.currentPeriodStart) : startOfMonth(now);
  return { planKey: sub?.planKey ?? "free", periodStart };
}

async function countUsage(resource: PlanLimitResource, userId: string, periodStart: Date): Promise<number> {
  const key = usageCacheKey(resource, userId, periodStart);
  const cached = await cacheGetInt(key);
  if (cached !== null) return cached;

  let count = 0;
  if (resource === "invoicesPerMonth") {
    count = await Invoice.countDocuments({ userId, createdAt: { $gte: periodStart } });
  } else if (resource === "customers") {
    count = await Customer.countDocuments({ userId, createdAt: { $gte: periodStart } });
  } else if (resource === "aiGenerationsPerMonth") {
    count = await AiUsage.countDocuments({ userId, kind: "generate", createdAt: { $gte: periodStart } });
  }

  await cacheSetInt(key, count, USAGE_CACHE_TTL_SECONDS);
  return count;
}

/**
 * Current limit + usage for one resource (this billing period). Returns the
 * plan's limit (-1 = unlimited) and how many records the tenant has used.
 */
export async function getUsageSnapshot(
  userId: string,
  resource: PlanLimitResource
): Promise<{ planKey: PlanKey; limit: number; usage: number; periodStart: Date }> {
  const { planKey, periodStart } = await getUsageContext(userId);
  const plan = getPlanByKey(planKey);
  const limit = plan?.limits[resource] ?? FREE_PLAN.limits[resource];
  const usage = await countUsage(resource, userId, periodStart);
  return { planKey, limit, usage, periodStart };
}

/**
 * Bumps the tenant's usage count after a successful create/generation. Best
 * effort — never throws (a counting failure must not roll back the create).
 */
export async function recordUsage(resource: PlanLimitResource, userId: string): Promise<void> {
  try {
    const { periodStart } = await getUsageContext(userId);
    const key = usageCacheKey(resource, userId, periodStart);
    // Invalidate cached count so the next read recounts exactly from Mongo
    await cacheDelete(key);
  } catch (error) {
    logger.warn({ err: error, userId, resource }, "Failed to record usage");
  }
}

/**
 * Drops the usage-cache keys for a user's current period — used when a plan or
 * period change would otherwise leave a stale count around.
 */
export async function invalidateUsageCaches(userId: string): Promise<void> {
  try {
    const { periodStart } = await getUsageContext(userId);
    for (const resource of ALL_RESOURCES) {
      await cacheDelete(usageCacheKey(resource, userId, periodStart));
    }
  } catch (error) {
    logger.warn({ err: error, userId }, "Failed to invalidate usage caches");
  }
}

/**
 * Route middleware enforcing a plan limit on resource creation. Counts usage in
 * the current billing period (see `getUsageContext`) and rejects the request
 * with 402 `PLAN_LIMIT_EXCEEDED` (carrying limit + usage) when the tenant is at
 * their cap. Apply after `authenticate` and body validation.
 */
export function enforcePlanLimit(resource: PlanLimitResource) {
  return async (req: Request, _res: Response, next: NextFunction) => {
    try {
      const snapshot = await getUsageSnapshot(req.user!.userId, resource);
      if (notBlocked(snapshot)) return next();

      const label = RESOURCE_LABELS[resource];
      const message = snapshot.limit === -1
        ? `Plan ${label} limit reached`
        : `${capitalize(label)} limit reached (${snapshot.usage}/${snapshot.limit} per period). Upgrade your plan to continue.`;
      next(new PaymentRequiredError(message, { resource, limit: snapshot.limit, usage: snapshot.usage, planKey: snapshot.planKey }));
    } catch (error) {
      next(error);
    }
  };
}

function notBlocked(snapshot: { limit: number; usage: number }): boolean {
  return snapshot.limit === -1 || snapshot.usage < snapshot.limit;
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}