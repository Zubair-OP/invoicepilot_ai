import { Request, Response, NextFunction } from "express";
import { INVOICE_TEMPLATES } from "./templates.registry.js";
import { User } from "../../database/models/index.js";
import { getPlanByKey, FREE_PLAN } from "../billing/plans.registry.js";
import { successResponse } from "../../common/response.js";

// The template list is scoped to the tenant's plan: `free` sees only `classic`,
// paid plans see the templates their plan allows (Phase 8 plan limits).
export async function list(req: Request, res: Response, next: NextFunction) {
  try {
    const user = await User.findOne({ _id: req.user!.userId, deletedAt: { $exists: false } })
      .select("subscription")
      .lean();
    const plan = getPlanByKey(user?.subscription?.planKey);
    const allowed = plan?.limits.templatesAllowed ?? FREE_PLAN.limits.templatesAllowed;
    res.json(successResponse(INVOICE_TEMPLATES.filter((template) => allowed.includes(template.id))));
  } catch (error) {
    next(error);
  }
}