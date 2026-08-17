import { User } from "../../database/models/index.js";
import { NotFoundError } from "../../common/errors/index.js";
import type { UpdateSettingsInput } from "./settings.validation.js";
import type { IUserSettings } from "../../common/types/index.js";

// Scope by the Mongo userId like every other tenant query. The auth cache stores
// only { userId, clerkId, role }, none of which settings touch, so there is no
// cache entry to invalidate on write.

export async function getSettings(userId: string): Promise<IUserSettings> {
  const user = await User.findOne({ _id: userId, deletedAt: { $exists: false } })
    .select("settings")
    .lean();
  if (!user) throw new NotFoundError("User");
  return user.settings;
}

import { getPlanByKey } from "../billing/plans.registry.js";
import { PaymentRequiredError } from "../../common/errors/index.js";

export async function updateSettings(
  userId: string,
  data: UpdateSettingsInput
): Promise<IUserSettings> {
  const user = await User.findOne({ _id: userId, deletedAt: { $exists: false } });
  if (!user) throw new NotFoundError("User");

  const planKey = user.subscription?.planKey ?? "free";
  const plan = getPlanByKey(planKey);

  // Validate template access based on user's active plan
  if (data.templateId) {
    const allowed = plan?.limits.templatesAllowed ?? ["classic"];
    if (!allowed.includes(data.templateId)) {
      throw new PaymentRequiredError(
        `The "${data.templateId}" template requires an upgrade. It is not available on the ${plan?.name ?? "Free"} plan.`,
        { templateId: data.templateId, planKey, requiredPlan: data.templateId === "minimal" ? "premium" : "pro" }
      );
    }
  }

  // Validate custom reminder interval — premium-only feature
  if (data.reminders?.intervalMinutes !== undefined) {
    const canCustomize = plan?.limits.customReminderInterval ?? false;
    if (!canCustomize) {
      throw new PaymentRequiredError(
        "Custom reminder interval is a Premium feature. Upgrade your plan to customize the sweep cadence.",
        { planKey, requiredPlan: "premium" }
      );
    }
  }

  // Merge onto the existing subdocument so a PATCH of one field leaves the rest
  // intact. Assigning per-key marks the nested path modified for Mongoose.
  for (const [key, value] of Object.entries(data)) {
    user.set(`settings.${key}`, value);
  }

  await user.save();
  return user.settings;
}
