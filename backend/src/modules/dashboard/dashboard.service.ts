import mongoose from "mongoose";
import { Invoice } from "../../database/models/index.js";
import type { InvoiceStatus } from "../../common/types/index.js";
import { cacheGetJSON, cacheSetJSON } from "../../common/cache/redis.js";
import type { DashboardRange } from "./dashboard.validation.js";

const UNPAID_STATUSES = ["SENT", "OVERDUE"] as const;
// "Revenue" = issued but not draft/cancelled: sent, paid, or overdue.
const ISSUED_STATUSES = ["SENT", "PAID", "OVERDUE"] as const;
const ALL_STATUSES = ["DRAFT", "SENT", "PAID", "OVERDUE", "CANCELLED"] as const;

const DAY_MS = 24 * 60 * 60 * 1000;
const DASHBOARD_CACHE_TTL_SECONDS = 300;

export interface CurrencyTotal {
  currency: string;
  amount: number;
  count: number;
}

export interface StatusBreakdown {
  status: InvoiceStatus;
  count: number;
  totals: CurrencyTotal[];
}

export interface RecentInvoice {
  id: string;
  invoiceNumber: string;
  status: InvoiceStatus;
  currency: string;
  total: number;
  issuedAt: string;
  dueDate: string;
  customerName?: string;
}

export interface TopCustomer {
  customerId: string;
  name: string;
  currency: string;
  revenue: number;
  invoiceCount: number;
}

export interface MonthlyRevenue {
  month: string;
  totals: CurrencyTotal[];
}

export interface UserDashboard {
  period: { from: string; to: string };
  totals: {
    outstanding: CurrencyTotal[];
    paid: CurrencyTotal[];
    overdue: { count: number; totals: CurrencyTotal[] };
  };
  invoicesByStatus: StatusBreakdown[];
  recentInvoices: RecentInvoice[];
  topCustomers: TopCustomer[];
  monthlyRevenueTrend: MonthlyRevenue[];
  averageDaysToPayment: number | null;
}

interface CurrencyGroup {
  _id: string;
  amount: number;
  count: number;
}

interface StatusCurrencyGroup {
  _id: { status: string; currency: string };
  count: number;
  amount: number;
}

interface TrendGroup {
  _id: { month: string; currency: string };
  amount: number;
  count: number;
}

interface AvgDaysGroup {
  _id: null;
  avgDays: number;
}

interface CustomerGroup {
  _id: { customerId: mongoose.Types.ObjectId; currency: string };
  revenue: number;
  count: number;
  customer: { name: string } | null;
}

function tenantId(userId: string): mongoose.Types.ObjectId {
  return new mongoose.Types.ObjectId(userId);
}

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

/** Maps a `$group`-by-currency result set into currency-total pairs. Shared with admin analytics. */
export function toCurrencyTotals(rows: CurrencyGroup[]): CurrencyTotal[] {
  return rows.map((row) => ({ currency: row._id, amount: roundMoney(row.amount), count: row.count }));
}

/**
 * All money the tenant is owed right now: every SENT/OVERDUE invoice. A live
 * snapshot — deliberately not bound by ?from=/?to=, which only narrows the
 * period stats.
 */
async function queryOutstanding(userId: string): Promise<CurrencyTotal[]> {
  const rows = await Invoice.aggregate<CurrencyGroup>([
    { $match: { userId: tenantId(userId), status: { $in: UNPAID_STATUSES } } },
    { $group: { _id: "$currency", amount: { $sum: "$total" }, count: { $sum: 1 } } },
  ]);
  return toCurrencyTotals(rows);
}

/** Money actually received in the period: PAID invoices whose paidAt falls inside. */
async function queryPaidInPeriod(userId: string, from: Date, to: Date): Promise<CurrencyTotal[]> {
  const rows = await Invoice.aggregate<CurrencyGroup>([
    { $match: { userId: tenantId(userId), status: "PAID", paidAt: { $gte: from, $lt: to } } },
    { $group: { _id: "$currency", amount: { $sum: "$total" }, count: { $sum: 1 } } },
  ]);
  return toCurrencyTotals(rows);
}

/** Issued-but-unpaid invoices past their due date right now (count + amount by currency). */
async function queryOverdue(userId: string): Promise<{ count: number; totals: CurrencyTotal[] }> {
  const now = new Date();
  const rows = await Invoice.aggregate<CurrencyGroup>([
    { $match: { userId: tenantId(userId), status: { $in: UNPAID_STATUSES }, dueDate: { $lt: now } } },
    { $group: { _id: "$currency", amount: { $sum: "$total" }, count: { $sum: 1 } } },
  ]);
  const totals = toCurrencyTotals(rows);
  return { count: totals.reduce((sum, total) => sum + total.count, 0), totals };
}

/** Invoice count + value per status within the period, zero-filled for every status. */
async function queryInvoicesByStatus(userId: string, from: Date, to: Date): Promise<StatusBreakdown[]> {
  const rows = await Invoice.aggregate<StatusCurrencyGroup>([
    { $match: { userId: tenantId(userId), issuedAt: { $gte: from, $lt: to } } },
    {
      $group: {
        _id: { status: "$status", currency: "$currency" },
        count: { $sum: 1 },
        amount: { $sum: "$total" },
      },
    },
  ]);

  const byStatus = new Map<InvoiceStatus, StatusBreakdown>();
  for (const status of ALL_STATUSES) {
    byStatus.set(status, { status, count: 0, totals: [] });
  }
  for (const row of rows) {
    const entry = byStatus.get(row._id.status as InvoiceStatus);
    if (!entry) continue;
    entry.count += row.count;
    entry.totals.push({ currency: row._id.currency, amount: roundMoney(row.amount), count: row.count });
  }

  return ALL_STATUSES.map((status) => byStatus.get(status)!);
}

/** The five newest invoices (dashboard header list). */
async function getRecentInvoices(userId: string): Promise<RecentInvoice[]> {
  const invoices = await Invoice.find({ userId: tenantId(userId) })
    .sort({ createdAt: -1 })
    .limit(5)
    .select("invoiceNumber status currency total issuedAt dueDate customerId")
    .populate("customerId", "name")
    .lean();

  return invoices.map((invoice) => ({
    id: invoice._id.toString(),
    invoiceNumber: invoice.invoiceNumber,
    status: invoice.status,
    currency: invoice.currency,
    total: invoice.total,
    issuedAt: invoice.issuedAt.toISOString(),
    dueDate: invoice.dueDate.toISOString(),
    customerName: (invoice.customerId as { name?: string } | null)?.name,
  }));
}

/**
 * Top customers by period revenue, ranked per currency (never summing across
 * currencies). A missing customer falls back to a placeholder rather than being
 * dropped — the invoice record is what matters.
 */
async function queryTopCustomers(userId: string, from: Date, to: Date): Promise<TopCustomer[]> {
  const rows = await Invoice.aggregate<CustomerGroup>([
    { $match: { userId: tenantId(userId), status: { $in: ISSUED_STATUSES }, issuedAt: { $gte: from, $lt: to } } },
    {
      $group: {
        _id: { customerId: "$customerId", currency: "$currency" },
        revenue: { $sum: "$total" },
        count: { $sum: 1 },
      },
    },
    { $sort: { revenue: -1 } },
    { $limit: 5 },
    { $lookup: { from: "customers", localField: "_id.customerId", foreignField: "_id", as: "customer" } },
    { $unwind: { path: "$customer", preserveNullAndEmptyArrays: true } },
  ]);

  return rows.map((row) => ({
    customerId: row._id.customerId.toString(),
    name: row.customer?.name ?? "Deleted customer",
    currency: row._id.currency,
    revenue: roundMoney(row.revenue),
    invoiceCount: row.count,
  }));
}

function startOfMonth(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
}

function monthKey(date: Date): string {
  return date.toISOString().slice(0, 7);
}

/** The 12 calendar months ending in the month of `to` (inclusive), oldest first. */
function buildMonthKeys(to: Date): string[] {
  const first = startOfMonth(to);
  const keys: string[] = [];
  for (let i = 11; i >= 0; i--) {
    keys.push(monthKey(new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() - i, 1))));
  }
  return keys;
}

/** Revenue per calendar month over the last 12 months, grouped by currency, zero-filled. */
async function queryMonthlyTrend(userId: string, to: Date): Promise<MonthlyRevenue[]> {
  const monthKeys = buildMonthKeys(to);
  const first = startOfMonth(to);
  const trendStart = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() - 11, 1));

  const rows = await Invoice.aggregate<TrendGroup>([
    { $match: { userId: tenantId(userId), status: { $in: ISSUED_STATUSES }, issuedAt: { $gte: trendStart, $lt: to } } },
    {
      $group: {
        _id: {
          month: { $dateToString: { format: "%Y-%m", date: "$issuedAt", timezone: "UTC" } },
          currency: "$currency",
        },
        amount: { $sum: "$total" },
        count: { $sum: 1 },
      },
    },
  ]);

  const buckets = new Map<string, MonthlyRevenue>(monthKeys.map((key) => [key, { month: key, totals: [] }]));
  for (const row of rows) {
    const bucket = buckets.get(row._id.month);
    if (!bucket) continue;
    bucket.totals.push({ currency: row._id.currency, amount: roundMoney(row.amount), count: row.count });
  }

  return monthKeys.map((key) => buckets.get(key)!);
}

/** Mean days between issuedAt and paidAt for invoices paid in the period; null when none. */
async function queryAvgDaysToPayment(userId: string, from: Date, to: Date): Promise<number | null> {
  const rows = await Invoice.aggregate<AvgDaysGroup>([
    { $match: { userId: tenantId(userId), status: "PAID", paidAt: { $gte: from, $lt: to } } },
    {
      $group: {
        _id: null,
        avgDays: { $avg: { $divide: [{ $subtract: ["$paidAt", "$issuedAt"] }, DAY_MS] } },
      },
    },
  ]);

  const avgDays = rows[0]?.avgDays;
  return avgDays === undefined ? null : Math.round(avgDays * 10) / 10;
}

function dashboardCacheKey(userId: string, range: DashboardRange): string {
  return `dashboard:${userId}:${range.from.getTime()}:${range.to.getTime()}`;
}

/**
 * Full user dashboard. Expensive aggregations are cached in Redis for 5 minutes
 * keyed by tenant + range — dashboards are refreshed far more often than the
 * underlying data changes.
 */
export async function getDashboard(userId: string, range: DashboardRange): Promise<UserDashboard> {
  const cacheKey = dashboardCacheKey(userId, range);
  const cached = await cacheGetJSON(cacheKey);
  if (cached !== null) return cached as UserDashboard;

  const [outstanding, paid, overdue, invoicesByStatus, recentInvoices, topCustomers, monthlyRevenueTrend, averageDaysToPayment] =
    await Promise.all([
      queryOutstanding(userId),
      queryPaidInPeriod(userId, range.from, range.to),
      queryOverdue(userId),
      queryInvoicesByStatus(userId, range.from, range.to),
      getRecentInvoices(userId),
      queryTopCustomers(userId, range.from, range.to),
      queryMonthlyTrend(userId, range.to),
      queryAvgDaysToPayment(userId, range.from, range.to),
    ]);

  const dashboard: UserDashboard = {
    period: { from: range.from.toISOString(), to: range.to.toISOString() },
    totals: { outstanding, paid, overdue },
    invoicesByStatus,
    recentInvoices,
    topCustomers,
    monthlyRevenueTrend,
    averageDaysToPayment,
  };

  await cacheSetJSON(cacheKey, dashboard, DASHBOARD_CACHE_TTL_SECONDS);
  return dashboard;
}
