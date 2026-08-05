import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import mongoose from "mongoose";
import type { Request, Response, NextFunction } from "express";
import { env } from "../../config/env.js";
import { User, Invoice } from "../../database/models/index.js";
import { handleStripeBillingEvent } from "./billing.events.js";
import { enforcePlanLimit } from "./billing.limits.js";
import { sendEmail } from "../../integrations/email/index.js";
import { PaymentRequiredError } from "../../common/errors/index.js";

const redis = vi.hoisted(() => ({
  cacheGetInt: vi.fn(),
  cacheSetInt: vi.fn(),
  cacheIncrement: vi.fn(),
  cacheDelete: vi.fn(),
  claimIdempotencyKey: vi.fn(),
  releaseIdempotencyKey: vi.fn(),
}));

vi.mock("../../common/cache/redis.js", () => redis);
vi.mock("../../integrations/email/index.js", async (importActual) => {
  const actual = await importActual<typeof import("../../integrations/email/index.js")>();
  return { ...actual, sendEmail: vi.fn() };
});

const PREFIX = "user_phase8_events";
const STRIPE_CUSTOMER = "cus_phase8_test";

function subscriptionEvent(type: string, id: string, object: Record<string, unknown>) {
  return handleStripeBillingEvent({ id, type, data: { object } });
}

function checkoutEvent(userId: string, planKey: string) {
  return subscriptionEvent(
    "checkout.session.completed",
    `evt_checkout_${planKey}`,
    {
      id: "cs_1",
      mode: "subscription",
      customer: STRIPE_CUSTOMER,
      subscription: "sub_1",
      metadata: { userId, planKey },
    }
  );
}

function createInvoice(userId: mongoose.Types.ObjectId, createdAt: Date, index: number) {
  return Invoice.create({
    userId,
    customerId: new mongoose.Types.ObjectId(),
    invoiceNumber: `PHASE8-EV-${userId.toString().slice(-6)}-${index}`,
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

describe("Stripe billing webhook events", () => {
  beforeAll(async () => {
    await mongoose.connect(env.MONGO_URI);
  });

  afterAll(async () => {
    await User.deleteMany({ clerkId: { $regex: `^${PREFIX}` } });
    await Invoice.deleteMany({ invoiceNumber: { $regex: /^PHASE8-EV-/ } });
    await mongoose.disconnect();
  });

  beforeEach(async () => {
    await User.deleteMany({ clerkId: { $regex: `^${PREFIX}` } });
    await Invoice.deleteMany({ invoiceNumber: { $regex: /^PHASE8-EV-/ } });

    redis.cacheGetInt.mockReset().mockResolvedValue(null);
    redis.cacheSetInt.mockReset().mockResolvedValue(undefined);
    redis.cacheIncrement.mockReset().mockResolvedValue(1);
    redis.cacheDelete.mockReset().mockResolvedValue(undefined);
    redis.claimIdempotencyKey.mockReset().mockResolvedValue(true);
    redis.releaseIdempotencyKey.mockReset().mockResolvedValue(undefined);
    vi.mocked(sendEmail).mockReset().mockResolvedValue(undefined);
  });

  it("treats a replayed event id as a no-op", async () => {
    const user = await User.create({
      clerkId: `${PREFIX}_replay`,
      email: "replay@example.com",
      name: "Replay",
      subscription: { planKey: "free", status: "active", stripeCustomerId: STRIPE_CUSTOMER },
    });

    redis.claimIdempotencyKey.mockResolvedValueOnce(false);

    const status = await subscriptionEvent(
      "customer.subscription.deleted",
      "evt_replay",
      { id: "sub_replay", customer: STRIPE_CUSTOMER }
    );

    expect(status).toBe("duplicate");
    const fresh = await User.findById(user._id).lean();
    expect(fresh?.subscription.planKey).toBe("free"); // untouched
  });

  it("activates a subscription from checkout.session.completed", async () => {
    const user = await User.create({
      clerkId: `${PREFIX}_upgrade`,
      email: "upgrade@example.com",
      name: "Upgrade",
      subscription: { planKey: "free", status: "active", stripeCustomerId: STRIPE_CUSTOMER },
    });

    const status = await checkoutEvent(user._id.toString(), "pro");

    expect(status).toBe("handled");
    const fresh = await User.findById(user._id).lean();
    expect(fresh?.subscription.planKey).toBe("pro");
    expect(fresh?.subscription.status).toBe("active");
    expect(fresh?.subscription.stripeSubscriptionId).toBe("sub_1");
  });

  it("applies subscription period + status from customer.subscription.updated", async () => {
    const user = await User.create({
      clerkId: `${PREFIX}_period`,
      email: "period@example.com",
      name: "Period",
      subscription: { planKey: "pro", status: "active", stripeCustomerId: STRIPE_CUSTOMER },
    });

    const start = Math.floor(Date.now() / 1000) - 86400;
    const end = Math.floor(Date.now() / 1000) + 29 * 86400;

    const status = await subscriptionEvent(
      "customer.subscription.updated",
      "evt_sub_updated",
      {
        id: "sub_period",
        customer: STRIPE_CUSTOMER,
        status: "past_due",
        current_period_start: start,
        current_period_end: end,
        items: { data: [{ price: { id: "price_unknown" } }] },
      }
    );

    expect(status).toBe("handled");
    const fresh = await User.findById(user._id).lean();
    expect(fresh?.subscription.status).toBe("past_due");
    expect(fresh?.subscription.currentPeriodEnd!.getTime()).toBe(end * 1000);
    // Unknown price id → plan is left untouched, never silently downgraded.
    expect(fresh?.subscription.planKey).toBe("pro");
  });

  it("downgrade blocks new creation but destroys no data", async () => {
    const user = await User.create({
      clerkId: `${PREFIX}_downgrade`,
      email: "downgrade@example.com",
      name: "Downgrade",
      subscription: { planKey: "business", status: "active", stripeCustomerId: STRIPE_CUSTOMER },
    });

    const now = new Date();
    for (let i = 0; i < 5; i++) await createInvoice(user._id, now, i);

    const status = await checkoutEvent(user._id.toString(), "free");
    expect(status).toBe("handled");

    const fresh = await User.findById(user._id).lean();
    expect(fresh?.subscription.planKey).toBe("free");

    // Durable data survives the downgrade.
    expect(await Invoice.countDocuments({ userId: user._id })).toBe(5);

    // But new creation is now blocked at the free cap.
    const req = { id: "req", user: { userId: user._id.toString(), clerkId: "x", role: "USER" as const } } as Request;
    const res = {} as Response;
    let captured: unknown;
    const next: NextFunction = (err?: unknown) => {
      captured = err;
    };
    await enforcePlanLimit("invoicesPerMonth")(req, res, next);
    const error = captured;
    expect(error).toBeInstanceOf(PaymentRequiredError);
    expect((error as PaymentRequiredError).details).toMatchObject({ limit: 5, usage: 5 });
  });

  it("marks past_due and emails on invoice.payment_failed", async () => {
    await User.create({
      clerkId: `${PREFIX}_pastdue`,
      email: "pastdue@example.com",
      name: "Past Due",
      subscription: { planKey: "pro", status: "active", stripeCustomerId: STRIPE_CUSTOMER, stripeSubscriptionId: "sub_pd" },
    });

    const status = await subscriptionEvent(
      "invoice.payment_failed",
      "evt_payment_failed",
      { id: "in_pd", customer: STRIPE_CUSTOMER, amount_due: 1200, currency: "usd" }
    );

    expect(status).toBe("handled");
    const fresh = await User.findOne({ clerkId: `${PREFIX}_pastdue` }).lean();
    expect(fresh?.subscription.status).toBe("past_due");
    expect(vi.mocked(sendEmail)).toHaveBeenCalledTimes(1);
    expect(vi.mocked(sendEmail).mock.calls[0][0].to).toBe("pastdue@example.com");
  });
});