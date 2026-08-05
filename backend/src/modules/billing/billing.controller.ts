import { Request, Response, NextFunction } from "express";
import * as billingService from "./billing.service.js";
import { successResponse } from "../../common/response.js";

export function listPlans(_req: Request, res: Response, next: NextFunction) {
  try {
    res.json(successResponse(billingService.listPlans()));
  } catch (error) {
    next(error);
  }
}

export async function getSubscription(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await billingService.getSubscription(req.user!.userId);
    res.json(successResponse(result));
  } catch (error) {
    next(error);
  }
}

export async function checkout(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await billingService.createCheckout(req.user!.userId, req.body.planKey);
    res.json(successResponse(result, "Checkout session created"));
  } catch (error) {
    next(error);
  }
}

export async function portal(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await billingService.createPortal(req.user!.userId);
    res.json(successResponse(result, "Billing portal session created"));
  } catch (error) {
    next(error);
  }
}