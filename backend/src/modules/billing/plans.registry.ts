import type { PlanKey } from "../../common/types/index.js";

export interface PlanLimits {
  invoicesPerMonth: number;      // -1 = unlimited
  customers: number;             // -1 = unlimited
  aiGenerationsPerMonth: number; // -1 = unlimited
  templatesAllowed: string[];    // template ids from the Phase 3 registry
}

export interface PlanDefinition {
  key: PlanKey;
  name: string;
  description: string;
  /** Real Stripe Price ID — set to your Stripe account's subscription price. */
  stripePriceId?: string;
  limits: PlanLimits;
  priceMonthly: number;
}

// Plans ship with the code as a constant, like invoice templates: they are the
// source of truth for what the enforcement layer allows. The `Plan` Mongo model
// (Phase 8) is seeded from here at boot so the collection exists and stays in
// sync, but the runtime reads these constants so a missing/unseeded plan document
// can never block work.
//
// NOTE: `stripePriceId` cannot be hardcoded to a real value from this repo — it
// is specific to the operator's Stripe account. Fill it in before enabling
// subscriptions (checkout returns 503 for a plan without a price id).
export const PLANS: readonly PlanDefinition[] = [
  {
    key: "free",
    name: "Free",
    description: "For trying the platform — core features with gentle limits.",
    limits: {
      invoicesPerMonth: 5,
      customers: 10,
      aiGenerationsPerMonth: 10,
      templatesAllowed: ["classic"],
    },
    priceMonthly: 0,
  },
  {
    key: "pro",
    name: "Pro",
    description: "For growing businesses that invoice regularly.",
    limits: {
      invoicesPerMonth: 100,
      customers: -1,
      aiGenerationsPerMonth: 200,
      templatesAllowed: ["classic", "modern", "minimal"],
    },
    priceMonthly: 12,
  },
  {
    key: "business",
    name: "Business",
    description: "Unlimited invoicing and AI for high-volume teams.",
    limits: {
      invoicesPerMonth: -1,
      customers: -1,
      aiGenerationsPerMonth: -1,
      templatesAllowed: ["classic", "modern", "minimal"],
    },
    priceMonthly: 29,
  },
] as const;

export function getPlanByKey(key: string | undefined): PlanDefinition | undefined {
  return PLANS.find((plan) => plan.key === key);
}

export function getPlanByPriceId(priceId: string | undefined): PlanDefinition | undefined {
  return PLANS.find((plan) => plan.stripePriceId === priceId);
}

export const FREE_PLAN = getPlanByKey("free")!;