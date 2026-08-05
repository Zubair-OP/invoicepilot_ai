import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import mongoose from "mongoose";
import type { Request, Response, NextFunction } from "express";
import { env } from "../../config/env.js";
import { User, Invoice, Customer } from "../../database/models/index.js";
import { PaymentRequiredError } from "../../common/errors/index.js";
import { enforcePlanLimit, getUsageSnapshot } from "./billing.limits.js";

const redis = vi.hoisted(() => ({
  cacheGetInt: vi.fn(),
  cacheSetInt: vi.fn(),
  cacheIncrement: vi.fn(),
  cacheDelete: vi.fn(),
}));

vi.mock("../../common/cache/redis.js", () => redis);

const PREFIX = "user_phase8_limits";

interface Capture {
  next: NextFunction;
  error: () => unknown;
}

function captureNext(): Capture {
  let captured: unknown;
  const next: NextFunction = (err?: unknown) => {
    captured = err;
  };
  return { next, error: () => captured };
}

async function runMiddleware(
  middleware: ReturnType<typeof enforcePlanLimit>,
  userId: string
): Promise<Capture> {
  const req = { id: "req_1", user: { userId, clerkId: "x", role: "USER" as const } } as Request;
  const res = {} as Response;
  const capture = captureNext();
  await middleware(req, res, capture.next);
  return capture;
}

function createInvoice(userId: mongoose.Types.ObjectId, createdAt: Date, index = 0) {
  return Invoice.create({
    userId,
    customerId: new mongoose.Types.ObjectId(),
    invoiceNumber: `LIM8-${userId.toString().slice(-6)}-${index}`,
    status: "DRAFT",
    currency: "USD",
    subtotal: 100,
    tax: 0,
    discount: 0,
    total: 100,
    items: [{ description: "test", quantity: 1, unitPrice: 100, total: 100 }],
    dueDate: new Date(Date.now() + 86400000),
    issuedAt: createdAt,
    createdAt,
  });
}

describe("plan limit enforcement", () => {
  beforeAll(async () => {
    await mongoose.connect(env.MONGO_URI);
  });

  afterAll(async () => {
    await User.deleteMany({ clerkId: { $regex: `^${PREFIX}` } });
    await Invoice.deleteMany({ invoiceNumber: { $regex: /^LIM8-/ } });
    await Customer.deleteMany({ name: { $regex: /^Phase8 Customer/ } });
    await mongoose.disconnect();
  });

  beforeEach(async () => {
    await User.deleteMany({ clerkId: { $regex: `^${PREFIX}` } });
    await Invoice.deleteMany({ invoiceNumber: { $regex: /^LIM8-/ } });
    await Customer.deleteMany({ name: { $regex: /^Phase8 Customer/ } });

    // No Redis cache hits: force every read to recount from Mongo.
    redis.cacheGetInt.mockReset().mockResolvedValue(null);
    redis.cacheSetInt.mockReset().mockResolvedValue(undefined);
    redis.cacheDelete.mockReset().mockResolvedValue(undefined);
    redis.cacheIncrement.mockReset().mockResolvedValue(1);
  });

  it("blocks a free tenant at the 6th invoice with 402 + usage detail", async () => {
    const user = await User.create({ clerkId: `${PREFIX}_free`, email: "free@example.com", name: "Free" });
    const createdAt = new Date();
    for (let i = 0; i < 5; i++) await createInvoice(user._id, createdAt, i);

    const capture = await runMiddleware(enforcePlanLimit("invoicesPerMonth"), user._id.toString());

    const error = capture.error();
    expect(error).toBeInstanceOf(PaymentRequiredError);
    expect((error as PaymentRequiredError).details).toMatchObject({
      resource: "invoicesPerMonth",
      limit: 5,
      usage: 5,
      planKey: "free",
    });
  });

  it("allows creation below the limit", async () => {
    const user = await User.create({ clerkId: `${PREFIX}_free2`, email: "free2@example.com", name: "Free 2" });
    for (let i = 0; i < 4; i++) await createInvoice(user._id, new Date(), i);

    const capture = await runMiddleware(enforcePlanLimit("invoicesPerMonth"), user._id.toString());
    expect(capture.error()).toBeUndefined();
  });

  it("upgrading to pro unblocks creation immediately", async () => {
    const user = await User.create({
      clerkId: `${PREFIX}_pro`,
      email: "pro@example.com",
      name: "Pro",
      subscription: { planKey: "pro", status: "active" },
    });
    for (let i = 0; i < 5; i++) await createInvoice(user._id, new Date(), i);

    const capture = await runMiddleware(enforcePlanLimit("invoicesPerMonth"), user._id.toString());
    expect(capture.error()).toBeUndefined();
  });

  it("counts usage on the billing period, not the calendar month", async () => {
    const periodStart = new Date(Date.now() - 20 * 86400000);
    const periodEnd = new Date(Date.now() + 15 * 86400000);
    const user = await User.create({
      clerkId: `${PREFIX}_period`,
      email: "period@example.com",
      name: "Period",
      subscription: { planKey: "pro", status: "active", currentPeriodStart: periodStart, currentPeriodEnd: periodEnd },
    });

    // Before the billing period → excluded; inside it → counted.
    await createInvoice(user._id, new Date(Date.now() - 40 * 86400000), 0);
    await createInvoice(user._id, new Date(Date.now() - 5 * 86400000), 1);

    const snapshot = await getUsageSnapshot(user._id.toString(), "invoicesPerMonth");
    expect(snapshot.usage).toBe(1);
  });

  it("enforces the customer limit too", async () => {
    const user = await User.create({ clerkId: `${PREFIX}_cust`, email: "cust@example.com", name: "Cust" });
    for (let i = 0; i < 10; i++) {
      await Customer.create({ userId: user._id, name: `Phase8 Customer ${i}` });
    }

    const capture = await runMiddleware(enforcePlanLimit("customers"), user._id.toString());
    const error = capture.error();
    expect(error).toBeInstanceOf(PaymentRequiredError);
    expect((error as PaymentRequiredError).details).toMatchObject({ resource: "customers", limit: 10, usage: 10 });
  });
});