import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from "vitest";
import mongoose from "mongoose";
import { env } from "../../config/env.js";
import { User, Invoice, AiUsage } from "../../database/models/index.js";
import { getPlatformAnalytics } from "./admin.analytics.js";

const redis = vi.hoisted(() => ({
  cacheGetJSON: vi.fn(),
  cacheSetJSON: vi.fn(),
}));

vi.mock("../../common/cache/redis.js", () => redis);

const PREFIX = "user_phase9_admin";
const DAY_MS = 24 * 60 * 60 * 1000;

// Fixtures live in a fixed past window. Other test files create their rows "now"
// (or at daysAgo(40)/daysAgo(5) in billing.limits.test, which are outside this
// window because `to` is exclusive), so the windowed aggregations here are exact
// even though every test file shares the same database.
const WINDOW_FROM = new Date(Date.now() - 60 * DAY_MS);
const WINDOW_TO = new Date(Date.now() - 40 * DAY_MS);
const range = { from: WINDOW_FROM, to: WINDOW_TO };

function daysAgo(n: number): Date {
  return new Date(Date.now() - n * DAY_MS);
}

async function cleanup() {
  await User.deleteMany({ clerkId: { $regex: `^${PREFIX}` } });
  await Invoice.deleteMany({ invoiceNumber: { $regex: /^ADM9-/ } });
  // No other test file writes AiUsage rows (and the seed does not), so wiping
  // the collection is safe and guarantees a row orphaned by an interrupted run
  // can never pollute the windowed assertions.
  await AiUsage.deleteMany({});
}

describe("platform analytics", { timeout: 60000 }, () => {
  beforeAll(async () => {
    await mongoose.connect(env.MONGO_URI);
  });

  afterAll(async () => {
    await cleanup();
    await mongoose.disconnect();
  });

  beforeEach(async () => {
    await cleanup();
    redis.cacheGetJSON.mockReset().mockResolvedValue(null);
    redis.cacheSetJSON.mockReset().mockResolvedValue(undefined);
  });

  // Clean after every test too, so a fixture left behind by a timed-out test can
  // never pollute the next one's windowed assertions.
  afterEach(async () => {
    await cleanup();
  });

  it("reflects users, subscriptions, invoice volume and AI usage created in the window", async () => {
    // Baseline first. Snapshot metrics (users.total, active subscriptions, MRR)
    // span the whole database, which other test files also write to, so those
    // deltas are asserted as >= our contribution. Everything scoped to the past
    // window is asserted exactly.
    const before = await getPlatformAnalytics(range);
    const freeUser = await User.create({
      clerkId: `${PREFIX}_free`,
      email: "adm-free@example.com",
      name: "Adm Free",
      subscription: { planKey: "free", status: "active" },
      createdAt: daysAgo(55),
    });
    await User.create({
      clerkId: `${PREFIX}_pro`,
      email: "adm-pro@example.com",
      name: "Adm Pro",
      subscription: { planKey: "pro", status: "active" },
      createdAt: daysAgo(50),
    });
    await User.create({
      clerkId: `${PREFIX}_business`,
      email: "adm-business@example.com",
      name: "Adm Business",
      subscription: { planKey: "business", status: "active" },
      createdAt: daysAgo(48),
    });
    // Canceled and soft-deleted accounts must not count as subscribers/users.
    await User.create({
      clerkId: `${PREFIX}_canceled`,
      email: "adm-canceled@example.com",
      name: "Adm Canceled",
      subscription: { planKey: "pro", status: "canceled" },
      createdAt: daysAgo(45),
    });
    await User.create({
      clerkId: `${PREFIX}_deleted`,
      email: "adm-deleted@example.com",
      name: "Adm Deleted",
      subscription: { planKey: "free", status: "active" },
      createdAt: daysAgo(43),
      deletedAt: daysAgo(43),
    });

    const proUser = await User.findOne({ clerkId: `${PREFIX}_pro` }).lean();
    const customerId = new mongoose.Types.ObjectId();
    for (let i = 0; i < 2; i++) {
      await Invoice.create({
        userId: proUser!._id,
        customerId,
        invoiceNumber: `ADM9-000${i + 1}`,
        status: i === 0 ? "PAID" : "SENT",
        currency: i === 0 ? "USD" : "INR",
        subtotal: i === 0 ? 100 : 500,
        tax: 0,
        discount: 0,
        total: i === 0 ? 100 : 500,
        items: [{ description: "test", quantity: 1, unitPrice: i === 0 ? 100 : 500, total: i === 0 ? 100 : 500 }],
        issuedAt: daysAgo(44),
        dueDate: new Date(Date.now() + 86400000),
        ...(i === 0 ? { paidAt: daysAgo(43) } : {}),
      });
    }

    // Durable AI usage: 3 generations + 2 chats on the same day in the window,
    // 1 generation after it.
    for (let i = 0; i < 3; i++) {
      await AiUsage.create({ userId: freeUser._id, kind: "generate", createdAt: daysAgo(47) });
    }
    for (let i = 0; i < 2; i++) {
      await AiUsage.create({ userId: freeUser._id, kind: "chat", createdAt: daysAgo(47) });
    }
    await AiUsage.create({ userId: freeUser._id, kind: "generate", createdAt: daysAgo(39) });

    const after = await getPlatformAnalytics(range);

    // Users: 4 live accounts added; the soft-deleted one is excluded (exact,
    // because growth is windowed).
    expect(after.users.growth).toBe(before.users.growth + 4);
    expect(after.users.total).toBeGreaterThanOrEqual(before.users.total + 4);

    // Active subscriptions: free/pro/business each gained one; canceled +0.
    const planCount = (key: "free" | "pro" | "business") =>
      after.activeSubscriptionsByPlan.find((entry) => entry.planKey === key)!.count;
    const beforePlanCount = (key: "free" | "pro" | "business") =>
      before.activeSubscriptionsByPlan.find((entry) => entry.planKey === key)!.count;
    expect(planCount("free")).toBeGreaterThanOrEqual(beforePlanCount("free") + 1);
    expect(planCount("pro")).toBeGreaterThanOrEqual(beforePlanCount("pro") + 1);
    expect(planCount("business")).toBeGreaterThanOrEqual(beforePlanCount("business") + 1);

    // MRR = 1 pro ($12) + 1 business ($29).
    expect(after.mrr).toBeGreaterThanOrEqual(before.mrr + 41);

    // Invoice volume: 2 issued invoices in the window, USD 100 + INR 500 grouped separately.
    expect(after.invoiceVolume.count).toBe(before.invoiceVolume.count + 2);
    const volumeByCurrency = Object.fromEntries(after.invoiceVolume.totalByCurrency.map((total) => [total.currency, total.amount]));
    expect(volumeByCurrency.USD).toBe((before.invoiceVolume.totalByCurrency.find((t) => t.currency === "USD")?.amount ?? 0) + 100);
    expect(volumeByCurrency.INR).toBe((before.invoiceVolume.totalByCurrency.find((t) => t.currency === "INR")?.amount ?? 0) + 500);

    // AI usage: exactly 5 in the window (3 generate + 2 chat); the day-39 row is outside.
    expect(after.aiUsage.total).toBe(before.aiUsage.total + 5);
    const aiByKind = Object.fromEntries(after.aiUsage.byKind.map((entry) => [entry.kind, entry.count]));
    expect(aiByKind.generate).toBe((before.aiUsage.byKind.find((e) => e.kind === "generate")?.count ?? 0) + 3);
    expect(aiByKind.chat).toBe((before.aiUsage.byKind.find((e) => e.kind === "chat")?.count ?? 0) + 2);

    // Signups over time: exactly 4 non-zero days (free/pro/business/canceled);
    // the soft-deleted user adds nothing.
    const signupsSum = after.signupsOverTime.reduce((sum, day) => sum + day.count, 0);
    const beforeSignupsSum = before.signupsOverTime.reduce((sum, day) => sum + day.count, 0);
    expect(signupsSum).toBe(beforeSignupsSum + 4);
    expect(after.signupsOverTime.filter((day) => day.count > 0)).toHaveLength(4);

    // AI usage over time: sum matches, exactly one non-zero day.
    const aiSum = after.aiUsageOverTime.reduce((sum, day) => sum + day.count, 0);
    const beforeAiSum = before.aiUsageOverTime.reduce((sum, day) => sum + day.count, 0);
    expect(aiSum).toBe(beforeAiSum + 5);
    expect(after.aiUsageOverTime.filter((day) => day.count > 0)).toHaveLength(1);
  });

  it("returns zeroed windowed structures when nothing exists in the window", async () => {
    // A window no fixture (or concurrent test) touches: everything is past the
    // fixtures, and other files create their rows "now".
    const analytics = await getPlatformAnalytics({ from: WINDOW_FROM, to: WINDOW_TO });

    expect(analytics.users.growth).toBe(0);
    expect(analytics.invoiceVolume.count).toBe(0);
    expect(analytics.invoiceVolume.totalByCurrency).toEqual([]);
    expect(analytics.aiUsage.total).toBe(0);
    expect(analytics.aiUsage.byKind).toEqual([
      { kind: "generate", count: 0 },
      { kind: "chat", count: 0 },
    ]);
    expect(analytics.signupsOverTime.every((day) => day.count === 0)).toBe(true);
    expect(analytics.aiUsageOverTime.every((day) => day.count === 0)).toBe(true);

    // Global snapshot metrics still have their zero-filled shape.
    expect(analytics.activeSubscriptionsByPlan).toHaveLength(3);
    for (const entry of analytics.activeSubscriptionsByPlan) {
      expect(entry).toMatchObject({ planKey: expect.any(String), count: expect.any(Number), mrr: expect.any(Number) });
    }
  });
});
