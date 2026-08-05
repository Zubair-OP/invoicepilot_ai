import { User, Invoice } from "../../database/models/index.js";
import { claimIdempotencyKey, releaseIdempotencyKey } from "../../common/cache/redis.js";
import { sendEmail, paymentFailedEmail } from "../../integrations/email/index.js";
import { logger } from "../../observability/logger.js";
import type { PlanKey, SubscriptionStatus } from "../../common/types/index.js";
import { getPlanByKey, getPlanByPriceId, FREE_PLAN } from "./plans.registry.js";
import { invalidateUsageCaches } from "./billing.limits.js";

const STRIPE_EVENT_TTL_SECONDS = 24 * 60 * 60;

// Minimal, SDK-free shapes of the Stripe webhook objects this service reads.
// The route passes the verified `Stripe.Event`; each handler narrows only the
// fields it needs so the service stays unit-testable with plain objects.
export interface StripeWebhookEvent {
  id: string;
  type: string;
  data: { object: unknown };
}

interface StripeSubscriptionLike {
  id: string;
  customer: string;
  status: string;
  current_period_start: number;
  current_period_end: number;
  items?: { data?: Array<{ price?: { id?: string } | null }> };
}

interface StripeCheckoutSessionLike {
  id: string;
  mode?: string;
  customer?: string | null;
  subscription?: string | null;
  metadata?: Record<string, string> | null;
}

interface StripeInvoiceLike {
  id: string;
  customer?: string | null;
  amount_due?: number;
  currency?: string;
}

type WebhookStatus = "handled" | "ignored" | "duplicate";

/**
 * Processes a signature-verified Stripe event. Idempotent per Stripe event id
 * (Stripe retries aggressively on non-2xx), so a replayed webhook is a no-op.
 */
export async function handleStripeBillingEvent(event: StripeWebhookEvent): Promise<WebhookStatus> {
  const claimed = await claimIdempotencyKey(`stripe:${event.id}`, STRIPE_EVENT_TTL_SECONDS);
  if (!claimed) return "duplicate";

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as StripeCheckoutSessionLike;
        if (session.mode === "subscription") {
          await handleSubscriptionCheckout(session);
        } else {
          await handleInvoicePaymentCheckout(session);
        }
        return "handled";
      }
      case "customer.subscription.created":
      case "customer.subscription.updated": {
        await applySubscription(event.data.object as StripeSubscriptionLike);
        return "handled";
      }
      case "customer.subscription.deleted": {
        await cancelSubscription(event.data.object as StripeSubscriptionLike);
        return "handled";
      }
      case "invoice.payment_failed": {
        await handlePaymentFailed(event.data.object as StripeInvoiceLike);
        return "handled";
      }
      case "payment_intent.payment_failed": {
        const object = event.data.object as { id?: string };
        logger.warn({ paymentIntent: object?.id }, "Stripe payment failed");
        return "ignored";
      }
      default:
        logger.debug({ eventType: event.type }, "Unhandled Stripe event");
        return "ignored";
    }
  } catch (error) {
    // Release the idempotency key so a genuine (non-replay) retry can process.
    await releaseIdempotencyKey(`stripe:${event.id}`);
    throw error;
  }
}

async function handleSubscriptionCheckout(session: StripeCheckoutSessionLike): Promise<void> {
  const user = await findUserForSession(session);
  if (!user) {
    logger.warn({ sessionId: session.id }, "Checkout session references unknown user");
    return;
  }

  const planKey = getPlanByKey(session.metadata?.planKey) ? (session.metadata!.planKey as PlanKey) : user.subscription.planKey;

  user.subscription.planKey = planKey;
  user.subscription.status = "active";
  if (session.customer) user.subscription.stripeCustomerId = session.customer;
  if (session.subscription) user.subscription.stripeSubscriptionId = session.subscription;
  await user.save();

  await invalidateUsageCaches(user._id.toString());
  logger.info({ userId: user._id.toString(), planKey }, "Subscription activated via checkout");
}

async function findUserForSession(session: StripeCheckoutSessionLike) {
  if (session.metadata?.userId) {
    const byUserId = await User.findOne({ _id: session.metadata.userId, deletedAt: { $exists: false } });
    if (byUserId) return byUserId;
  }
  if (session.customer) {
    return User.findOne({ "subscription.stripeCustomerId": session.customer, deletedAt: { $exists: false } });
  }
  return null;
}

async function handleInvoicePaymentCheckout(session: StripeCheckoutSessionLike): Promise<void> {
  const invoiceId = session.metadata?.invoiceId;
  if (!invoiceId) return;

  await Invoice.findByIdAndUpdate(invoiceId, { status: "PAID", paidAt: new Date() });
  logger.info({ invoiceId }, "Invoice paid via Stripe checkout");
}

async function applySubscription(sub: StripeSubscriptionLike): Promise<void> {
  const user = await User.findOne({ "subscription.stripeCustomerId": sub.customer, deletedAt: { $exists: false } });
  if (!user) {
    logger.warn({ customer: sub.customer }, "Subscription event references unknown customer");
    return;
  }

  const priceId = sub.items?.data?.[0]?.price?.id;
  const planByPrice = getPlanByPriceId(priceId);
  if (priceId && !planByPrice) {
    logger.warn({ priceId, userId: user._id.toString() }, "Subscription price does not match any plan — keeping current plan");
  }

  user.subscription.planKey = planByPrice?.key ?? user.subscription.planKey;
  user.subscription.status = mapStripeStatus(sub.status);
  user.subscription.stripeSubscriptionId = sub.id;
  user.subscription.stripeCustomerId = sub.customer;
  user.subscription.currentPeriodStart = new Date(sub.current_period_start * 1000);
  user.subscription.currentPeriodEnd = new Date(sub.current_period_end * 1000);
  await user.save();

  await invalidateUsageCaches(user._id.toString());
  logger.info({ userId: user._id.toString(), planKey: user.subscription.planKey, status: user.subscription.status }, "Subscription updated");
}

async function cancelSubscription(sub: StripeSubscriptionLike): Promise<void> {
  const user = await User.findOne({ "subscription.stripeCustomerId": sub.customer, deletedAt: { $exists: false } });
  if (!user) {
    logger.warn({ customer: sub.customer }, "Subscription deletion references unknown customer");
    return;
  }

  // Downgrade to free but keep all existing data. Limits drop for *new* records
  // only — a tenant over the free cap retains their invoices and customers.
  user.subscription.planKey = FREE_PLAN.key;
  user.subscription.status = "canceled";
  user.subscription.stripeSubscriptionId = undefined;
  user.subscription.currentPeriodStart = undefined;
  user.subscription.currentPeriodEnd = undefined;
  await user.save();

  await invalidateUsageCaches(user._id.toString());
  logger.info({ userId: user._id.toString() }, "Subscription cancelled");
}

async function handlePaymentFailed(invoice: StripeInvoiceLike): Promise<void> {
  if (!invoice.customer) return;

  const user = await User.findOne({ "subscription.stripeCustomerId": invoice.customer, deletedAt: { $exists: false } });
  if (!user) {
    logger.warn({ customer: invoice.customer }, "Payment-failed event references unknown customer");
    return;
  }

  if (user.subscription.stripeSubscriptionId) {
    user.subscription.status = "past_due";
    await user.save();
    await invalidateUsageCaches(user._id.toString());
  }

  // Best-effort notification — a mail failure must not break the webhook ack.
  try {
    const rendered = paymentFailedEmail({
      businessName: user.settings?.businessName ?? "InvoicePilot",
      amount: invoice.amount_due,
      currency: invoice.currency,
    });
    await sendEmail({ to: user.email, subject: rendered.subject, html: rendered.html, text: rendered.text });
  } catch (error) {
    logger.error({ err: error, userId: user._id.toString() }, "Failed to email payment-failed notice");
  }
}

function mapStripeStatus(status: string): SubscriptionStatus {
  switch (status) {
    case "active":
      return "active";
    case "trialing":
      return "trialing";
    case "past_due":
      return "past_due";
    case "canceled":
    case "unpaid":
    case "uncollectible":
    case "incomplete":
    case "incomplete_expired":
    case "paused":
    default:
      return "canceled";
  }
}
