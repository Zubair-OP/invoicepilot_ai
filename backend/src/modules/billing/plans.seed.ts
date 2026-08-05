import { Plan } from "../../database/models/index.js";
import { PLANS } from "./plans.registry.js";
import { logger } from "../../observability/logger.js";

/**
 * Idempotently upserts the seeded plan documents from the registry. Called at
 * server boot so a fresh database always has the `Plan` collection populated;
 * safe to run on every start (keyed on the unique `key` field).
 */
export async function seedPlans(): Promise<void> {
  try {
    await Promise.all(
      PLANS.map((plan) => {
        const doc: Record<string, unknown> = {
          name: plan.name,
          limits: plan.limits,
          priceMonthly: plan.priceMonthly,
        };
        if (plan.stripePriceId) doc.stripePriceId = plan.stripePriceId;
        return Plan.updateOne({ key: plan.key }, { $set: doc }, { upsert: true });
      })
    );
  } catch (error) {
    logger.error({ err: error }, "Failed to seed plans");
  }
}