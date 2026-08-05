import { User } from "../../database/models/index.js";
import { NotFoundError, ValidationError, ServiceUnavailableError } from "../../common/errors/index.js";
import { createPlanCheckoutSession, createBillingPortalSession, stripe } from "../../integrations/stripe/stripe.js";
import { getUsageSnapshot } from "./billing.limits.js";
import { PLANS, getPlanByKey, FREE_PLAN, type PlanDefinition } from "./plans.registry.js";
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
 * Current subscription + usage for the tenant across all tracked resources.
 * Usage is scoped to the current billing period (see billing.limits).
 */
export async function getSubscription(userId: string) {
  const user = await User.findOne({ _id: userId, deletedAt: { $exists: false } })
    .select("subscription")
    .lean();
  if (!user) throw new NotFoundError("User");

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