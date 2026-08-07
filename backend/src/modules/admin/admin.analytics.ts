import { User, Invoice, AiUsage } from "../../database/models/index.js";
import { ValidationError } from "../../common/errors/index.js";
import type { PlanKey } from "../../common/types/index.js";
import { PLANS } from "../billing/plans.registry.js";
import type { DashboardRange } from "../dashboard/dashboard.validation.js";
import { toCurrencyTotals, type CurrencyTotal } from "../dashboard/dashboard.service.js";
import { cacheGetJSON, cacheSetJSON } from "../../common/cache/redis.js";

// Cross-tenant analytics for platform operators. Unlike every user-facing query,
// these pipelines deliberately span all tenants — that is their purpose — but the
// aggregation is confined to this module so a missing userId filter can never leak
// out of it by accident.

const ACTIVE_SUBSCRIPTION_STATUSES = ["active", "trialing"] as const;
const ISSUED_STATUSES = ["SENT", "PAID", "OVERDUE"] as const;
const DAY_MS = 24 * 60 * 60 * 1000;
const ANALYTICS_CACHE_TTL_SECONDS = 300;
// Defensive cap for direct service calls; the routes already reject longer ranges.
const MAX_BUCKET_DAYS = 400;

export interface PlanSubscriptionCount {
  planKey: PlanKey;
  count: number;
  mrr: number;
}

export interface AiUsageBreakdown {
  total: number;
  byKind: { kind: "generate" | "chat"; count: number }[];
}

export interface AdminAnalytics {
  period: { from: string; to: string };
  users: { total: number; growth: number };
  activeSubscriptionsByPlan: PlanSubscriptionCount[];
  mrr: number;
  invoiceVolume: { count: number; totalByCurrency: CurrencyTotal[] };
  aiUsage: AiUsageBreakdown;
  signupsOverTime: { date: string; count: number }[];
  aiUsageOverTime: { date: string; count: number }[];
}

interface CountGroup {
  _id: string;
  count: number;
}

function startOfDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function dayKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/**
 * Every calendar day from `from` to `to` inclusive, filled with the counted
 * values (zero when a day had none). `to`'s own day is included so an active day
 * with partial data is visible rather than silently dropped.
 */
function fillDayBuckets(
  from: Date,
  to: Date,
  rows: CountGroup[]
): { date: string; count: number }[] {
  const counts = new Map(rows.map((row) => [row._id, row.count]));
  const end = startOfDay(to);

  if ((end.getTime() - startOfDay(from).getTime()) / DAY_MS > MAX_BUCKET_DAYS) {
    throw new ValidationError({ from: ["Range too large for daily analytics"] });
  }

  const buckets: { date: string; count: number }[] = [];
  for (let cursor = startOfDay(from); cursor <= end; cursor = new Date(cursor.getTime() + DAY_MS)) {
    const key = dayKey(cursor);
    buckets.push({ date: key, count: counts.get(key) ?? 0 });
  }
  return buckets;
}

/** Non-deleted users: total (all time) and new signups within the period. */
async function queryUsers(from: Date, to: Date): Promise<{ total: number; growth: number }> {
  const [total, growth] = await Promise.all([
    User.countDocuments({ deletedAt: { $exists: false } }),
    User.countDocuments({ deletedAt: { $exists: false }, createdAt: { $gte: from, $lt: to } }),
  ]);
  return { total, growth };
}

/**
 * Active subscriptions per plan + MRR. MRR is the sum of each active subscription's
 * plan price (flat-rate plans, one subscription per tenant) — all prices are USD,
 * so a single number is meaningful.
 */
async function querySubscriptions(): Promise<{ activeSubscriptionsByPlan: PlanSubscriptionCount[]; mrr: number }> {
  const rows = await User.aggregate<{ _id: PlanKey; count: number }>([
    { $match: { deletedAt: { $exists: false }, "subscription.status": { $in: ACTIVE_SUBSCRIPTION_STATUSES } } },
    { $group: { _id: "$subscription.planKey", count: { $sum: 1 } } },
  ]);

  const counts = new Map<PlanKey, number>(rows.map((row) => [row._id, row.count]));
  const activeSubscriptionsByPlan = PLANS.map((plan) => {
    const count = counts.get(plan.key) ?? 0;
    return { planKey: plan.key, count, mrr: count * plan.priceMonthly };
  });

  return {
    activeSubscriptionsByPlan,
    mrr: activeSubscriptionsByPlan.reduce((sum, entry) => sum + entry.mrr, 0),
  };
}

/** Issued (non-draft, non-cancelled) invoices created in the period, count + value by currency. */
async function queryInvoiceVolume(from: Date, to: Date): Promise<{ count: number; totalByCurrency: CurrencyTotal[] }> {
  const rows = await Invoice.aggregate<{ _id: string; amount: number; count: number }>([
    { $match: { status: { $in: ISSUED_STATUSES }, issuedAt: { $gte: from, $lt: to } } },
    { $group: { _id: "$currency", amount: { $sum: "$total" }, count: { $sum: 1 } } },
  ]);

  const totalByCurrency = toCurrencyTotals(rows);
  const count = totalByCurrency.reduce((sum, total) => sum + total.count, 0);
  return { count, totalByCurrency };
}

async function queryAiUsage(from: Date, to: Date): Promise<AiUsageBreakdown> {
  const rows = await AiUsage.aggregate<{ _id: "generate" | "chat"; count: number }>([
    { $match: { createdAt: { $gte: from, $lt: to } } },
    { $group: { _id: "$kind", count: { $sum: 1 } } },
  ]);

  const byKindMap = new Map(rows.map((row) => [row._id, row.count]));
  const byKind = (["generate", "chat"] as const).map((kind) => ({ kind, count: byKindMap.get(kind) ?? 0 }));
  return { total: byKind.reduce((sum, entry) => sum + entry.count, 0), byKind };
}

/** New-user signups bucketed per day within the period. */
async function querySignupsOverTime(from: Date, to: Date): Promise<{ date: string; count: number }[]> {
  const rows = await User.aggregate<CountGroup>([
    { $match: { deletedAt: { $exists: false }, createdAt: { $gte: from, $lt: to } } },
    { $group: { _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt", timezone: "UTC" } }, count: { $sum: 1 } } },
  ]);
  return fillDayBuckets(from, to, rows);
}

/** AI usage bucketed per day within the period. */
async function queryAiUsageOverTime(from: Date, to: Date): Promise<{ date: string; count: number }[]> {
  const rows = await AiUsage.aggregate<CountGroup>([
    { $match: { createdAt: { $gte: from, $lt: to } } },
    { $group: { _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt", timezone: "UTC" } }, count: { $sum: 1 } } },
  ]);
  return fillDayBuckets(from, to, rows);
}

/**
 * Full platform analytics for the admin dashboard. Cached in Redis for 5 minutes
 * keyed by range; dashboards are refreshed often and these aggregations span the
 * whole dataset.
 */
export async function getPlatformAnalytics(range: DashboardRange): Promise<AdminAnalytics> {
  const cacheKey = `admin:analytics:${range.from.getTime()}:${range.to.getTime()}`;
  const cached = await cacheGetJSON(cacheKey);
  if (cached !== null) return cached as AdminAnalytics;

  const [users, subscriptions, invoiceVolume, aiUsage, signupsOverTime, aiUsageOverTime] = await Promise.all([
    queryUsers(range.from, range.to),
    querySubscriptions(),
    queryInvoiceVolume(range.from, range.to),
    queryAiUsage(range.from, range.to),
    querySignupsOverTime(range.from, range.to),
    queryAiUsageOverTime(range.from, range.to),
  ]);

  const analytics: AdminAnalytics = {
    period: { from: range.from.toISOString(), to: range.to.toISOString() },
    users,
    activeSubscriptionsByPlan: subscriptions.activeSubscriptionsByPlan,
    mrr: subscriptions.mrr,
    invoiceVolume,
    aiUsage,
    signupsOverTime,
    aiUsageOverTime,
  };

  await cacheSetJSON(cacheKey, analytics, ANALYTICS_CACHE_TTL_SECONDS);
  return analytics;
}
