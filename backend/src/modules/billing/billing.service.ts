import { User } from "../../database/models/index.js";
import { NotFoundError, ValidationError, ServiceUnavailableError } from "../../common/errors/index.js";
import { createPlanCheckoutSession, createBillingPortalSession, stripe } from "../../integrations/stripe/stripe.js";
import { getUsageSnapshot } from "./billing.limits.js";
import { PLANS, getPlanByKey, getPlanByPriceId, FREE_PLAN, type PlanDefinition } from "./plans.registry.js";
import { invalidateUsageCaches } from "./billing.limits.js";
import { logger } from "../../observability/logger.js";
import type { PlanKey } from "../../common/types/index.js";

function getStripeOrThrow() {
  if (!stripe) throw new ServiceUnavailableError("Billing is not configured (STRIPE_SECRET_KEY unset)");
  return stripe;
}

function publicPlan(plan: PlanDefinition) {
  const { key, name, description, limits, priceMonthly, stripePriceId } = plan;
  return { key, name, description, limits, priceMonthly, checkoutEnabled: Boolean(stripePriceId) };
}

/** Public, non-tenant plan catalogue. */
export function listPlans() {
  return PLANS.map(publicPlan);
}

/**
 * Synchronizes subscription state with Stripe.
 * Can be triggered after checkout redirect (with sessionId) or on demand.
 */
export async function syncSubscription(userId: string, sessionId?: string) {
  if (!stripe) return;

  const user = await User.findOne({ _id: userId, deletedAt: { $exists: false } });
  if (!user) throw new NotFoundError("User");

  let planChanged = false;

  if (sessionId && sessionId !== "{CHECKOUT_SESSION_ID}") {
    try {
      const session = await stripe.checkout.sessions.retrieve(sessionId);
      const isOwner =
        session.client_reference_id === userId ||
        session.metadata?.userId === userId ||
        (session.customer && session.customer === user.subscription?.stripeCustomerId);

      if (isOwner && (session.payment_status === "paid" || session.status === "complete")) {
        const metadataPlanKey = session.metadata?.planKey as PlanKey | undefined;
        let planKey: PlanKey = metadataPlanKey && getPlanByKey(metadataPlanKey) ? metadataPlanKey : "free";

        if (planKey === "free" && session.subscription) {
          const sub = await stripe.subscriptions.retrieve(session.subscription as string);
          const priceId = sub.items?.data?.[0]?.price?.id;
          const matchedPlan = getPlanByPriceId(priceId);
          if (matchedPlan) planKey = matchedPlan.key;
        }

        if (planKey !== "free") {
          user.subscription.planKey = planKey;
          user.subscription.status = "active";
          if (session.customer) user.subscription.stripeCustomerId = session.customer as string;
          if (session.subscription) user.subscription.stripeSubscriptionId = session.subscription as string;
          planChanged = true;
        }
      }
    } catch (err) {
      logger.warn({ err, userId, sessionId }, "Failed to verify Stripe checkout session during sync");
    }
  }

  // Fallback: If still on free or no sessionId, check Stripe customer's active subscriptions directly
  if (user.subscription?.stripeCustomerId && user.subscription.planKey === "free") {
    try {
      const subscriptions = await stripe.subscriptions.list({
        customer: user.subscription.stripeCustomerId,
        status: "active",
        limit: 1,
      });

      if (subscriptions.data.length > 0) {
        const sub = subscriptions.data[0];
        const priceId = sub.items?.data?.[0]?.price?.id;
        const matchedPlan = getPlanByPriceId(priceId);
        if (matchedPlan) {
          user.subscription.planKey = matchedPlan.key;
          user.subscription.status = "active";
          user.subscription.stripeSubscriptionId = sub.id;
          if (sub.current_period_start) user.subscription.currentPeriodStart = new Date(sub.current_period_start * 1000);
          if (sub.current_period_end) user.subscription.currentPeriodEnd = new Date(sub.current_period_end * 1000);
          planChanged = true;
        }
      }
    } catch (err) {
      logger.warn({ err, userId }, "Failed to query Stripe customer subscriptions during sync");
    }
  }

  if (planChanged) {
    await user.save();
    await invalidateUsageCaches(userId);
    logger.info({ userId, planKey: user.subscription.planKey }, "User subscription synced successfully from Stripe");
  }

  return user.subscription;
}

/**
 * Current subscription + usage for the tenant across all tracked resources.
 * Usage is scoped to the current billing period (see billing.limits).
 */
export async function getSubscription(userId: string, sessionId?: string) {
  if (sessionId) {
    await syncSubscription(userId, sessionId);
  }

  const user = await User.findOne({ _id: userId, deletedAt: { $exists: false } })
    .select("subscription")
    .lean();
  if (!user) throw new NotFoundError("User");

  // If user has a stripeCustomerId and is on free, do an auto-sync check
  if (stripe && user.subscription?.stripeCustomerId && user.subscription.planKey === "free") {
    await syncSubscription(userId);
    const refreshed = await User.findOne({ _id: userId, deletedAt: { $exists: false } })
      .select("subscription")
      .lean();
    if (refreshed) user.subscription = refreshed.subscription;
  }

  const planKey: PlanKey = user.subscription?.planKey ?? "free";
  const plan = getPlanByKey(planKey) ?? FREE_PLAN;

  const [invoices, customers, ai] = await Promise.all([
    getUsageSnapshot(userId, "invoicesPerMonth"),
    getUsageSnapshot(userId, "customers"),
    getUsageSnapshot(userId, "aiGenerationsPerMonth"),
  ]);

  const usage = (snapshot: { limit: number; usage: number }) => ({
    usage: snapshot.usage,
    limit: snapshot.limit,
    remaining: snapshot.limit === -1 ? -1 : Math.max(0, snapshot.limit - snapshot.usage),
    unlimited: snapshot.limit === -1,
  });

  return {
    subscription: {
      planKey,
      status: user.subscription?.status ?? "active",
      currentPeriodStart: user.subscription?.currentPeriodStart ?? undefined,
      currentPeriodEnd: user.subscription?.currentPeriodEnd ?? undefined,
    },
    plan: publicPlan(plan),
    usage: {
      invoices: usage(invoices),
      customers: usage(customers),
      ai: usage(ai),
    },
  };
}

/** Starts a Stripe Checkout session for a paid plan. */
export async function createCheckout(userId: string, planKey: PlanKey) {
  const plan = getPlanByKey(planKey);
  if (!plan) {
    throw new ValidationError({ planKey: ["Unknown plan"] });
  }
  if (plan.key === "free") {
    throw new ValidationError({ planKey: ["The free plan cannot be checked out"] });
  }
  if (!plan.stripePriceId) {
    throw new ServiceUnavailableError(`Plan "${plan.key}" has no Stripe price configured`);
  }

  getStripeOrThrow();

  const user = await User.findOne({ _id: userId, deletedAt: { $exists: false } });
  if (!user) throw new NotFoundError("User");

  // Reuse the existing Stripe customer, or provision one (and persist the id) so
  // later subscription webhooks can map a `customer_xxx` back to this user.
  let customerId = user.subscription.stripeCustomerId;
  if (!customerId) {
    const customer = await stripe!.customers.create({
      email: user.email,
      name: user.name,
      metadata: { userId: user._id.toString() },
    });
    customerId = customer.id;
    user.subscription.stripeCustomerId = customerId;
    await user.save();
  }

  const session = await createPlanCheckoutSession({
    customerId,
    userId: user._id.toString(),
    planKey: plan.key,
    priceId: plan.stripePriceId,
  });

  return { url: session.url };
}

/** Opens the Stripe Billing Portal for subscription management. */
export async function createPortal(userId: string) {
  getStripeOrThrow();

  const user = await User.findOne({ _id: userId, deletedAt: { $exists: false } })
    .select("subscription")
    .lean();
  if (!user) throw new NotFoundError("User");

  if (!user.subscription?.stripeCustomerId) {
    throw new ValidationError({ subscription: ["No Stripe customer exists for this account yet"] });
  }

  const session = await createBillingPortalSession({ customerId: user.subscription.stripeCustomerId });
  return { url: session.url };
}