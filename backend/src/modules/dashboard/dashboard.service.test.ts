import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import mongoose from "mongoose";
import { env } from "../../config/env.js";
import { User, Customer, Invoice } from "../../database/models/index.js";
import type { InvoiceStatus } from "../../common/types/index.js";
import { getDashboard, type CurrencyTotal } from "./dashboard.service.js";
import { resolveDashboardRange } from "./dashboard.validation.js";

const redis = vi.hoisted(() => ({
  cacheGetJSON: vi.fn(),
  cacheSetJSON: vi.fn(),
}));

vi.mock("../../common/cache/redis.js", () => redis);

const PREFIX = "user_phase9_dash";
const DAY_MS = 24 * 60 * 60 * 1000;

function daysAgo(n: number): Date {
  return new Date(Date.now() - n * DAY_MS);
}

function daysFromNow(n: number): Date {
  return new Date(Date.now() + n * DAY_MS);
}

function totalsByCurrency(totals: CurrencyTotal[]): Record<string, number> {
  return Object.fromEntries(totals.map((total) => [total.currency, total.amount]));
}

function createInvoice(params: {
  userId: mongoose.Types.ObjectId;
  customerId: mongoose.Types.ObjectId;
  invoiceNumber: string;
  status: InvoiceStatus;
  currency: string;
  total: number;
  issuedAt: Date;
  dueDate: Date;
  paidAt?: Date;
}) {
  return Invoice.create({
    userId: params.userId,
    customerId: params.customerId,
    invoiceNumber: params.invoiceNumber,
    status: params.status,
    currency: params.currency,
    subtotal: params.total,
    tax: 0,
    discount: 0,
    total: params.total,
    items: [{ description: "test", quantity: 1, unitPrice: params.total, total: params.total }],
    issuedAt: params.issuedAt,
    dueDate: params.dueDate,
    ...(params.paidAt ? { paidAt: params.paidAt } : {}),
  });
}

describe("user dashboard", { timeout: 60000 }, () => {
  beforeAll(async () => {
    await mongoose.connect(env.MONGO_URI);
  });

  afterAll(async () => {
    await User.deleteMany({ clerkId: { $regex: `^${PREFIX}` } });
    await Customer.deleteMany({ name: { $regex: /^Phase9 Customer/ } });
    await Invoice.deleteMany({ invoiceNumber: { $regex: /^DASH-/ } });
    await mongoose.disconnect();
  });

  beforeEach(async () => {
    await User.deleteMany({ clerkId: { $regex: `^${PREFIX}` } });
    await Customer.deleteMany({ name: { $regex: /^Phase9 Customer/ } });
    await Invoice.deleteMany({ invoiceNumber: { $regex: /^DASH-/ } });
    redis.cacheGetJSON.mockReset().mockResolvedValue(null);
    redis.cacheSetJSON.mockReset().mockResolvedValue(undefined);
  });

  it("returns correct period figures for a tenant with mixed statuses and currencies", async () => {
    const user = await User.create({ clerkId: `${PREFIX}_a`, email: "dash-a@example.com", name: "Dash A" });
    const customer = await Customer.create({ userId: user._id, name: "Phase9 Customer A" });

    await createInvoice({
      userId: user._id,
      customerId: customer._id,
      invoiceNumber: "DASH-0001",
      status: "PAID",
      currency: "USD",
      total: 100,
      issuedAt: daysAgo(2),
      dueDate: daysFromNow(20),
      paidAt: daysAgo(1),
    });
    await createInvoice({
      userId: user._id,
      customerId: customer._id,
      invoiceNumber: "DASH-0002",
      status: "PAID",
      currency: "INR",
      total: 1000,
      issuedAt: daysAgo(3),
      dueDate: daysFromNow(20),
      paidAt: daysAgo(1),
    });
    await createInvoice({
      userId: user._id,
      customerId: customer._id,
      invoiceNumber: "DASH-0003",
      status: "SENT",
      currency: "USD",
      total: 50,
      issuedAt: daysAgo(4),
      dueDate: daysFromNow(10),
    });
    await createInvoice({
      userId: user._id,
      customerId: customer._id,
      invoiceNumber: "DASH-0004",
      status: "OVERDUE",
      currency: "USD",
      total: 200,
      issuedAt: daysAgo(5),
      dueDate: daysAgo(10),
    });
    await createInvoice({
      userId: user._id,
      customerId: customer._id,
      invoiceNumber: "DASH-0005",
      status: "DRAFT",
      currency: "USD",
      total: 75,
      issuedAt: daysAgo(6),
      dueDate: daysFromNow(30),
    });
    await createInvoice({
      userId: user._id,
      customerId: customer._id,
      invoiceNumber: "DASH-0006",
      status: "CANCELLED",
      currency: "USD",
      total: 999,
      issuedAt: daysAgo(7),
      dueDate: daysFromNow(5),
    });

    const dashboard = await getDashboard(user._id.toString(), resolveDashboardRange());

    // Outstanding = issued-but-unpaid: DASH-0003 (50) + DASH-0004 (200).
    expect(dashboard.totals.outstanding).toEqual([{ currency: "USD", amount: 250, count: 2 }]);

    // Paid in period by paidAt: USD 100 + INR 1000 — never summed together.
    expect(totalsByCurrency(dashboard.totals.paid)).toEqual({ USD: 100, INR: 1000 });
    expect(dashboard.totals.paid.find((t) => t.currency === "USD")?.count).toBe(1);

    // Overdue = past-due unpaid: only DASH-0004.
    expect(dashboard.totals.overdue).toEqual({ count: 1, totals: [{ currency: "USD", amount: 200, count: 1 }] });

    // Status breakdown within the period, zero-filled.
    const byStatus = Object.fromEntries(dashboard.invoicesByStatus.map((entry) => [entry.status, entry.count]));
    expect(byStatus).toEqual({ DRAFT: 1, SENT: 1, PAID: 2, OVERDUE: 1, CANCELLED: 1 });
    const sent = dashboard.invoicesByStatus.find((entry) => entry.status === "SENT");
    expect(sent?.totals).toEqual([{ currency: "USD", amount: 50, count: 1 }]);

    // Recent invoices: newest 5 of the 6 created, newest first.
    expect(dashboard.recentInvoices).toHaveLength(5);
    expect(dashboard.recentInvoices[0].invoiceNumber).toBe("DASH-0006");
    expect(dashboard.recentInvoices.map((invoice) => invoice.customerName)).toEqual(expect.arrayContaining(["Phase9 Customer A"]));

    // Top customers ranked per currency.
    expect(dashboard.topCustomers).toHaveLength(2);
    const topUsd = dashboard.topCustomers.find((entry) => entry.currency === "USD");
    expect(topUsd).toMatchObject({ name: "Phase9 Customer A", revenue: 350, invoiceCount: 3 });
    const topInr = dashboard.topCustomers.find((entry) => entry.currency === "INR");
    expect(topInr).toMatchObject({ name: "Phase9 Customer A", revenue: 1000, invoiceCount: 1 });

    // Monthly trend covers 12 months; the revenue rolls up to 350 USD / 1000 INR.
    expect(dashboard.monthlyRevenueTrend).toHaveLength(12);
    const trendTotals: Record<string, number> = {};
    for (const month of dashboard.monthlyRevenueTrend) {
      for (const total of month.totals) trendTotals[total.currency] = (trendTotals[total.currency] ?? 0) + total.amount;
    }
    expect(trendTotals).toEqual({ USD: 350, INR: 1000 });

    // Average days to payment: (1 day + 2 days) / 2.
    expect(dashboard.averageDaysToPayment).toBe(1.5);
  });

  it("never includes another tenant's data", async () => {
    const user = await User.create({ clerkId: `${PREFIX}_iso_a`, email: "iso-a@example.com", name: "Iso A" });
    const customer = await Customer.create({ userId: user._id, name: "Phase9 Customer Iso" });

    const other = await User.create({ clerkId: `${PREFIX}_iso_b`, email: "iso-b@example.com", name: "Iso B" });
    const otherCustomer = await Customer.create({ userId: other._id, name: "Phase9 Customer Other" });

    await createInvoice({
      userId: user._id,
      customerId: customer._id,
      invoiceNumber: "DASH-1001",
      status: "SENT",
      currency: "USD",
      total: 10,
      issuedAt: daysAgo(1),
      dueDate: daysFromNow(10),
    });
    await createInvoice({
      userId: other._id,
      customerId: otherCustomer._id,
      invoiceNumber: "DASH-1002",
      status: "PAID",
      currency: "USD",
      total: 99999,
      issuedAt: daysAgo(1),
      dueDate: daysFromNow(10),
      paidAt: daysAgo(1),
    });

    const dashboard = await getDashboard(user._id.toString(), resolveDashboardRange());

    const allAmounts = [
      ...dashboard.totals.outstanding.map((t) => t.amount),
      ...dashboard.totals.paid.map((t) => t.amount),
      ...dashboard.totals.overdue.totals.map((t) => t.amount),
    ];
    expect(allAmounts).not.toContain(99999);
    expect(dashboard.recentInvoices.map((invoice) => invoice.invoiceNumber)).not.toContain("DASH-1002");
    expect(dashboard.topCustomers.map((entry) => entry.name)).not.toContain("Phase9 Customer Other");
  });

  it("returns zeroed structures for an empty account", async () => {
    const user = await User.create({ clerkId: `${PREFIX}_empty`, email: "empty@example.com", name: "Empty" });

    const dashboard = await getDashboard(user._id.toString(), resolveDashboardRange());

    expect(dashboard.totals.outstanding).toEqual([]);
    expect(dashboard.totals.paid).toEqual([]);
    expect(dashboard.totals.overdue).toEqual({ count: 0, totals: [] });
    expect(dashboard.invoicesByStatus).toHaveLength(5);
    expect(dashboard.invoicesByStatus.every((entry) => entry.count === 0 && entry.totals.length === 0)).toBe(true);
    expect(dashboard.recentInvoices).toEqual([]);
    expect(dashboard.topCustomers).toEqual([]);
    expect(dashboard.monthlyRevenueTrend).toHaveLength(12);
    expect(dashboard.monthlyRevenueTrend.every((month) => month.totals.length === 0)).toBe(true);
    expect(dashboard.averageDaysToPayment).toBeNull();
  });
});
