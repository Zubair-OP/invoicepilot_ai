import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import mongoose from "mongoose";
import { env } from "../../config/env.js";
import { User, Invoice } from "../../database/models/index.js";
import * as dashboardService from "./dashboard.service.js";

const redisMock = vi.hoisted(() => ({
  cacheGetJSON: vi.fn(),
  cacheSetJSON: vi.fn(),
}));

vi.mock("../../common/cache/redis.js", () => redisMock);

const PREFIX = "iso_dashboard";
const INVOICE_PREFIX = "ISODASH-";

function createPaidInvoice(userId: mongoose.Types.ObjectId, amount: number, index: number) {
  const paidAt = new Date();
  return Invoice.create({
    userId,
    customerId: new mongoose.Types.ObjectId(),
    invoiceNumber: `${INVOICE_PREFIX}${index}`,
    status: "PAID",
    currency: "USD",
    subtotal: amount,
    tax: 0,
    discount: 0,
    total: amount,
    items: [{ description: "iso dash item", quantity: 1, unitPrice: amount, total: amount }],
    dueDate: new Date(),
    issuedAt: new Date(Date.now() - 1000),
    paidAt,
  });
}

describe("dashboard tenant isolation", () => {
  let ownerId: string;
  let otherId: string;

  const range = {
    from: new Date(Date.now() - 30 * 86400000),
    to: new Date(Date.now() + 86400000),
  };

  beforeAll(async () => {
    await mongoose.connect(env.MONGO_URI);
  });

  afterAll(async () => {
    await User.deleteMany({ clerkId: { $regex: `^${PREFIX}` } });
    await Invoice.deleteMany({ invoiceNumber: { $regex: `^${INVOICE_PREFIX}` } });
    await mongoose.disconnect();
  });

  beforeEach(async () => {
    await User.deleteMany({ clerkId: { $regex: `^${PREFIX}` } });
    await Invoice.deleteMany({ invoiceNumber: { $regex: `^${INVOICE_PREFIX}` } });

    redisMock.cacheGetJSON.mockReset().mockResolvedValue(null);
    redisMock.cacheSetJSON.mockReset().mockResolvedValue(undefined);

    const owner = await User.create({ clerkId: `${PREFIX}_owner`, email: "dash-owner@example.com", name: "Owner" });
    const other = await User.create({ clerkId: `${PREFIX}_other`, email: "dash-other@example.com", name: "Other" });
    ownerId = owner._id.toString();
    otherId = other._id.toString();

    // Owner has a paid invoice of 500 USD; other has nothing.
    await createPaidInvoice(owner._id, 500, 0);
  });

  it("includes the owner's own data in their dashboard", async () => {
    const dashboard = await dashboardService.getDashboard(ownerId, range);
    const paid = dashboard.invoicesByStatus.find((entry) => entry.status === "PAID");
    expect(paid?.count).toBe(1);
    expect(paid?.totals[0]).toMatchObject({ currency: "USD", amount: 500, count: 1 });
  });

  it("never includes another tenant's data in a user's dashboard", async () => {
    const dashboard = await dashboardService.getDashboard(otherId, range);

    expect(dashboard.totals.outstanding).toEqual([]);
    expect(dashboard.totals.paid).toEqual([]);
    expect(dashboard.totals.overdue.count).toBe(0);
    expect(dashboard.recentInvoices).toHaveLength(0);
    expect(dashboard.topCustomers).toHaveLength(0);
    expect(dashboard.monthlyRevenueTrend.every((month) => month.totals.length === 0)).toBe(true);
    expect(dashboard.invoicesByStatus.every((entry) => entry.count === 0)).toBe(true);
  });
});
